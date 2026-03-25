import { TRPCError } from "@trpc/server"
import { isApiLogRateLimitMessage } from "@/lib/subscription-limit-messages"
import { recordApiUsage } from "@/server/usage-tracking/record-api-usage"

function buildRequestMetadata(request: Request) {
  const metadata: Record<string, string> = {}

  const contentType = request.headers.get("content-type")?.trim()
  const userAgent = request.headers.get("user-agent")?.trim()
  const forwardedFor = request.headers.get("x-forwarded-for")?.trim()

  if (contentType) {
    metadata.contentType = contentType
  }

  if (userAgent) {
    metadata.userAgent = userAgent
  }

  if (forwardedFor) {
    metadata.forwardedFor = forwardedFor
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
}

async function parseUsagePayload(request: Request) {
  let body: unknown

  try {
    body = await request.json()
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

  return body as Record<string, unknown>
}

function getErrorStatus(error: TRPCError) {
  if (isApiLogRateLimitMessage(error.message)) {
    return 503
  }

  return error.code === "BAD_REQUEST"
    ? 400
    : error.code === "UNAUTHORIZED"
      ? 401
      : error.code === "FORBIDDEN"
        ? 403
      : error.code === "NOT_FOUND"
        ? 404
        : error.code === "CONFLICT"
          ? 409
          : error.code === "PRECONDITION_FAILED"
            ? 412
            : 500
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key")?.trim()

  if (!apiKey) {
    return Response.json(
      { error: 'Missing "X-Api-Key" header.' },
      { status: 401 }
    )
  }

  try {
    const payload = await parseUsagePayload(request)

    const usageEvent = await recordApiUsage({
      apiKey,
      payload,
      requestId: request.headers.get("x-request-id"),
      metadata: buildRequestMetadata(request),
    })

    return Response.json({
      ok: true,
      usageEvent,
    })
  } catch (error) {
    if (error instanceof TRPCError) {
      return Response.json(
        { error: error.message },
        {
          status: getErrorStatus(error),
          headers: isApiLogRateLimitMessage(error.message)
            ? { "Retry-After": "1" }
            : undefined,
        }
      )
    }

    console.error("Failed to record API usage", error)

    return Response.json(
      { error: "Failed to record API usage." },
      { status: 500 }
    )
  }
}

export async function GET() {
  return Response.json(
    { error: "Use POST with a JSON object body." },
    { status: 405 }
  )
}
