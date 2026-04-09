import "server-only"

import { createHash } from "node:crypto"

import { db } from "@/db"
import { logger } from "@/lib/logger"
import { auth } from "@/server/auth"
import { toNextJsHandler } from "better-auth/next-js"

const { GET: authGet, POST: authPost } = toNextJsHandler(auth)

function isOAuthDebugPath(pathname: string) {
  return pathname.startsWith("/api/auth/oauth2/")
}

function summarizeRedirectUri(redirectUri: string | null) {
  if (!redirectUri) {
    return null
  }

  try {
    const parsed = new URL(redirectUri)

    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
    }
  } catch {
    return {
      invalid: true,
      value: redirectUri,
    }
  }
}

function summarizeCallbackUrl(url: string | null) {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)

    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      statePresent: parsed.searchParams.has("state"),
      codePresent: parsed.searchParams.has("code"),
      issPresent: parsed.searchParams.has("iss"),
    }
  } catch {
    return {
      invalid: true,
      value: url,
    }
  }
}

function summarizeSecret(secret: string | null) {
  if (!secret) {
    return null
  }

  return {
    length: secret.length,
    sha256Prefix: createHash("sha256").update(secret).digest("hex").slice(0, 12),
    hasLeadingOrTrailingWhitespace: secret.trim() !== secret,
  }
}

function sanitizeAuthParams(params: URLSearchParams) {
  return {
    clientId: params.get("client_id"),
    grantType: params.get("grant_type"),
    responseType: params.get("response_type"),
    scope: params.get("scope"),
    redirectUri: summarizeRedirectUri(params.get("redirect_uri")),
    statePresent: params.has("state"),
    codePresent: params.has("code"),
    codeVerifierPresent: params.has("code_verifier"),
    clientSecretPresent: params.has("client_secret"),
    clientSecret: summarizeSecret(params.get("client_secret")),
    oauthQueryPresent: params.has("oauth_query"),
    accept: params.get("accept"),
    iss: params.get("iss"),
  }
}

function redactSensitiveText(value: string) {
  return value
    .replace(
      /("?(?:access_token|refresh_token|client_secret|code|code_verifier)"?\s*[:=]\s*"?)[^"&,\s}]+("?)/gi,
      "$1[Redacted]$2"
    )
    .replace(
      /((?:access_token|refresh_token|client_secret|code|code_verifier)=)[^&\s]+/gi,
      "$1[Redacted]"
    )
}

async function getRequestLogFields(req: Request) {
  const url = new URL(req.url)
  const contentType = req.headers.get("content-type")
  const bodyText =
    req.method === "POST" && contentType?.includes("application/x-www-form-urlencoded")
      ? await req.clone().text()
      : null

  return {
    method: req.method,
    pathname: url.pathname,
    search: sanitizeAuthParams(url.searchParams),
    contentType,
    body: bodyText ? sanitizeAuthParams(new URLSearchParams(bodyText)) : null,
    hasAuthorizationHeader: req.headers.has("authorization"),
  }
}

async function getTokenClientDiagnostics(request: Awaited<ReturnType<typeof getRequestLogFields>>) {
  if (request.pathname !== "/api/auth/oauth2/token") {
    return null
  }

  const clientId = request.body?.clientId
  const submittedRedirectUri = request.body?.redirectUri

  if (!clientId) {
    return { clientIdPresent: false }
  }

  const client = await db.query.oauthClient.findFirst({
    where: (fields, { eq }) => eq(fields.clientId, clientId),
  })

  if (!client) {
    return {
      clientIdPresent: true,
      clientFound: false,
    }
  }

  const submittedRedirectUriString =
    submittedRedirectUri && "invalid" in submittedRedirectUri
      ? submittedRedirectUri.value
      : submittedRedirectUri
        ? `${submittedRedirectUri.origin}${submittedRedirectUri.pathname}`
        : null

  return {
    clientIdPresent: true,
    clientFound: true,
    disabled: client.disabled ?? false,
    public: client.public ?? false,
    hasStoredSecret: Boolean(client.clientSecret),
    tokenEndpointAuthMethod: client.tokenEndpointAuthMethod ?? null,
    requirePKCE: client.requirePKCE ?? null,
    redirectUriCount: client.redirectUris.length,
    redirectUriMatched: submittedRedirectUriString
      ? client.redirectUris.includes(submittedRedirectUriString)
      : null,
    redirectUris: client.redirectUris.map((uri) => summarizeRedirectUri(uri)),
  }
}

async function getResponseLogFields(pathname: string, response: Response) {
  const location = response.headers.get("location")
  const contentType = response.headers.get("content-type")
  const parsedBody =
    response.ok &&
    pathname === "/api/auth/oauth2/consent" &&
    contentType?.includes("application/json")
      ? await response.clone().json().catch(() => null)
      : null
  const bodyText =
    !response.ok && contentType?.includes("application/json")
      ? redactSensitiveText(await response.clone().text())
      : null

  return {
    status: response.status,
    location: location ? summarizeRedirectUri(location) : null,
    consentRedirect: summarizeCallbackUrl(
      parsedBody &&
        typeof parsedBody === "object" &&
        "url" in parsedBody &&
        typeof parsedBody.url === "string"
        ? parsedBody.url
        : null
    ),
    wwwAuthenticate: response.headers.get("WWW-Authenticate"),
    body: bodyText,
  }
}

async function withOAuthLogging(
  req: Request,
  handler: (request: Request) => Promise<Response>
) {
  const { pathname } = new URL(req.url)

  if (!isOAuthDebugPath(pathname)) {
    return handler(req)
  }

  const request = await getRequestLogFields(req)
  const client = await getTokenClientDiagnostics(request)
  logger.info({ request, client }, "OAuth route request")

  try {
    const response = await handler(req)
    const responseFields = await getResponseLogFields(pathname, response)

    if (response.ok) {
      logger.info(
        { request, client, response: responseFields },
        "OAuth route response"
      )
    } else {
      logger.warn(
        { request, client, response: responseFields },
        "OAuth route response"
      )
    }

    return response
  } catch (error) {
    logger.error({ err: error, request }, "OAuth route failure")
    throw error
  }
}

export async function GET(req: Request) {
  return withOAuthLogging(req, authGet)
}

export async function POST(req: Request) {
  return withOAuthLogging(req, authPost)
}
