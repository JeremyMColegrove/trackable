import { TRPCError } from "@trpc/server"

import { CounterCacheRepository } from "@/server/redis/counter-cache.repository"
import { getInvalidApiKeyAttemptLimit } from "@/server/usage-tracking/usage-ingress-config"

const invalidApiKeyAttemptCache = new CounterCacheRepository(
  "usage-invalid-api-key-attempts"
)

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
