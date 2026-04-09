import "server-only"

import { mcpHandler } from "@better-auth/oauth-provider"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

import { logger } from "@/lib/logger"
import { getAppOrigin, getMcpResourceUrl } from "@/lib/mcp-oauth"
import { getRuntimeConfig } from "@/lib/runtime-config"
import { validateCustomMcpToken } from "@/server/mcp/auth/custom-token-auth"
import {
  type McpAuthContext,
  McpAuthContextImpl,
} from "@/server/mcp/auth/mcp-auth-context"
import { buildMcpServer } from "@/server/mcp/mcp-server"

const APP_URL = getAppOrigin()
const MCP_URL = getMcpResourceUrl()

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function handleMcpRequest(
  req: Request,
  authContext: McpAuthContext
): Promise<Response> {
  const server = buildMcpServer(authContext)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: req.method === "POST",
  })
  await server.connect(transport)
  return withCors(await transport.handleRequest(req))
}

const oauthHandler = mcpHandler(
  {
    jwksUrl: `${APP_URL}/api/auth/jwks`,
    verifyOptions: { audience: MCP_URL, issuer: APP_URL },
  },
  async (req, jwt) => {
    if (typeof jwt.sub !== "string" || !jwt.sub) {
      return withCors(Response.json({ error: "UNAUTHORIZED" }, { status: 401 }))
    }

    const scopes =
      typeof jwt.scope === "string"
        ? jwt.scope.split(/\s+/).filter(Boolean)
        : []

    const authContext = new McpAuthContextImpl({
      userId: jwt.sub,
      scopes,
      tools: "all",
    })
    return handleMcpRequest(req, authContext)
  }
)

async function handler(req: Request): Promise<Response> {
  const token =
    req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
  const useCustomToken =
    getRuntimeConfig().features.customMCPServerTokens &&
    token?.startsWith("trk_mcp_")

  logger.info(
    {
      method: req.method,
      hasAuth: Boolean(token),
      authMode: useCustomToken ? "custom" : "oauth",
    },
    "MCP request received"
  )

  if (useCustomToken) {
    const authContext = await validateCustomMcpToken(token!)
    if (!authContext) {
      return withCors(Response.json({ error: "UNAUTHORIZED" }, { status: 401 }))
    }
    return handleMcpRequest(req, authContext)
  }

  try {
    const response = await oauthHandler(req)
    return response.headers.has("Access-Control-Allow-Origin")
      ? response
      : withCors(response)
  } catch (error) {
    logger.error({ err: error }, "MCP OAuth failure")
    return withCors(Response.json({ error: "INTERNAL_ERROR" }, { status: 500 }))
  }
}

export const OPTIONS = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS })
export const GET = handler
export const POST = handler
