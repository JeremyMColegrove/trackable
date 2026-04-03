import { Buffer } from "node:buffer"
import { isIP } from "node:net"

import { TRPCError } from "@trpc/server"

import { fingerprintValue } from "@/lib/log-sanitization"
import { getRuntimeConfig } from "@/lib/runtime-config"

const maxHeaderValueLength = 512
const maxRequestIdLength = 128

function truncateHeaderValue(value: string | null) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  return normalizedValue.slice(0, maxHeaderValueLength)
}

function parsePositiveInteger(value: string | null) {
  if (!value) {
    return null
  }

  const parsedValue = Number.parseInt(value, 10)

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null
  }

  return parsedValue
}

export function getUsagePayloadSizeLimitBytes() {
  return getRuntimeConfig().usage.maxBodyBytes
}

export function isJsonContentType(contentType: string | null) {
  if (!contentType) {
    return false
  }

  const normalizedContentType = contentType.split(";")[0]?.trim().toLowerCase()

  return (
    normalizedContentType === "application/json" ||
    normalizedContentType.endsWith("+json")
  )
}

export function getClientIp(headers: Headers) {
  const candidateValues = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0] ?? null,
  ]

  for (const candidate of candidateValues) {
    const normalizedCandidate = candidate?.trim()

    if (normalizedCandidate && isIP(normalizedCandidate)) {
      return normalizedCandidate
    }
  }

  return null
}

export function getUsageClientIdentity(headers: Headers) {
  const clientIp = getClientIp(headers)

  if (clientIp) {
    return `ip:${clientIp}`
  }

  const userAgent = truncateHeaderValue(headers.get("user-agent"))

  if (userAgent) {
    return `ua:${fingerprintValue(userAgent)}`
  }

  return "anonymous"
}

export function buildUsageRequestMetadata(
  request: Pick<Request, "headers">
): Record<string, string> | null {
  const metadata: Record<string, string> = {}

  const contentType = truncateHeaderValue(request.headers.get("content-type"))
  const userAgent = truncateHeaderValue(request.headers.get("user-agent"))
  const clientIp = getClientIp(request.headers)

  if (contentType) {
    metadata.contentType = contentType
  }

  if (userAgent) {
    metadata.userAgent = userAgent
  }

  if (clientIp) {
    metadata.clientIp = clientIp
  }

  return Object.keys(metadata).length > 0 ? metadata : null
}

export function normalizeUsageRequestId(requestId: string | null) {
  const normalizedRequestId = requestId?.trim()

  if (!normalizedRequestId) {
    return null
  }

  return normalizedRequestId.slice(0, maxRequestIdLength)
}

export async function parseUsagePayload(
  request: Pick<Request, "headers" | "text">,
  maxBytes: number = getUsagePayloadSizeLimitBytes()
) {
  const contentType = request.headers.get("content-type")

  if (!isJsonContentType(contentType)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: 'Content-Type must be "application/json".',
    })
  }

  const declaredContentLength = parsePositiveInteger(
    request.headers.get("content-length")
  )

  if (declaredContentLength !== null && declaredContentLength > maxBytes) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `Request body must not exceed ${maxBytes} bytes.`,
    })
  }

  const rawBody = await request.text()
  const payloadSizeBytes = Buffer.byteLength(rawBody, "utf8")
  let body: unknown

  if (payloadSizeBytes > maxBytes) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `Request body must not exceed ${maxBytes} bytes.`,
    })
  }

  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Request body must be valid JSON.",
    })
  }

  if (!body || Array.isArray(body) || typeof body !== "object") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  return {
    payload: body as Record<string, unknown>,
    payloadSizeBytes,
  }
}
