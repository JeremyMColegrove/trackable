import { TRPCError } from "@trpc/server"
import {
  isApiLogRateLimitMessage,
  isApiPayloadSizeLimitMessage,
} from "@/lib/subscription-limit-messages"
import { logger } from "@/lib/logger"
import { recordApiUsage } from "@/server/usage-tracking/record-api-usage"
import {
  buildUsageRequestMetadata,
  getUsageClientIdentity,
  normalizeUsageRequestId,
  parseUsagePayload,
} from "@/server/usage-tracking/usage-request-security"

export const runtime = "nodejs"

function createUsageResponse(
  body: Record<string, unknown>,
  init?: ResponseInit
) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")

  return Response.json(body, {
    ...init,
    headers,
  })
}

function getErrorStatus(error: TRPCError) {
  if (isApiPayloadSizeLimitMessage(error.message)) {
    return 413
  }

  if (isApiLogRateLimitMessage(error.message)) {
    return 429
  }

  return error.code === "BAD_REQUEST"
    ? 400
    : error.code === "PAYLOAD_TOO_LARGE"
      ? 413
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
                : error.code === "TOO_MANY_REQUESTS"
                  ? 429
                  : 500
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key")?.trim()

  if (!apiKey) {
    return createUsageResponse(
      { error: 'Missing "X-Api-Key" header.' },
      { status: 401 }
    )
  }

  try {
    const { payload, payloadSizeBytes } = await parseUsagePayload(request)
    const requestMetadata = buildUsageRequestMetadata(request)

    const usageEvent = await recordApiUsage({
      apiKey,
      payload,
      payloadSizeBytes,
      clientIdentity: getUsageClientIdentity(request.headers),
      requestId: normalizeUsageRequestId(request.headers.get("x-request-id")),
      metadata: requestMetadata,
    })

    return createUsageResponse({
      ok: true,
      usageEvent,
    })
  } catch (error) {
    if (error instanceof TRPCError) {
      return createUsageResponse(
        { error: error.message },
        {
          status: getErrorStatus(error),
          headers:
            isApiLogRateLimitMessage(error.message) ||
            error.code === "TOO_MANY_REQUESTS"
              ? { "Retry-After": "60" }
              : undefined,
        }
      )
    }

    logger.error({ err: error }, "Failed to record API usage")

    return createUsageResponse(
      { error: "Failed to record API usage." },
      { status: 500 }
    )
  }
}

export async function GET() {
  return createUsageResponse(
    { error: "Use POST with a JSON object body." },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  )
}
