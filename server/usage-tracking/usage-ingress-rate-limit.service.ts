import "server-only"

import { TRPCError } from "@trpc/server"

import { CounterCacheRepository } from "@/server/redis/counter-cache.repository"

const invalidApiKeyAttemptCache = new CounterCacheRepository(
  "usage-invalid-api-key-attempts"
)

const defaultInvalidApiKeyAttemptsPerMinute = 30

function getInvalidApiKeyAttemptLimit() {
  const configuredLimit = Number.parseInt(
    process.env.API_USAGE_INVALID_KEY_RATE_LIMIT_PER_MINUTE ?? "",
    10
  )

  if (Number.isFinite(configuredLimit) && configuredLimit > 0) {
    return configuredLimit
  }

  return defaultInvalidApiKeyAttemptsPerMinute
}

export class UsageIngressRateLimitService {
  async recordInvalidApiKeyAttempt(clientIdentity: string) {
    const currentMinute = Math.floor(Date.now() / 60_000)
    const counterKey = `${clientIdentity}:${currentMinute}`
    const limit = getInvalidApiKeyAttemptLimit()
    const count = await invalidApiKeyAttemptCache.incrementWindow(
      counterKey,
      1,
      60
    )

    if (count > limit) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many invalid API key attempts. Retry in one minute.",
      })
    }
  }
}

export const usageIngressRateLimitService = new UsageIngressRateLimitService()
