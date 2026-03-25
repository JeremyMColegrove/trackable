import "server-only"

import { logger } from "@/lib/logger"
import { BaseCacheRepository } from "./base-cache.repository"
import { redis } from "./redis-client"

export class CounterCacheRepository extends BaseCacheRepository<number> {
  constructor(prefix: string) {
    super(prefix, 60) // Default TTL is short for counters (e.g. 1 minute)
  }

  protected async fetchFallback(id: string): Promise<number | null> {
    return null
  }

  /**
   * Atomically increment a counter within a specific time window.
   * If the counter doesn't exist, it creates it with the given TTL.
   * For example, useful for rate limiting within a second or minute window.
   */
  async incrementWindow(id: string, amount: number = 1, ttlSeconds: number = this.defaultTtlSeconds): Promise<number> {
    const key = this.getKey(id)
    
    // We use a multi-block to ensure TTL is set on the first increment if not present
    const countResult = await redis.incrby(key, amount)
    
    // If it's a new key, the count will be `amount`. Set TTL.
    if (countResult === amount) {
      await redis.expire(key, ttlSeconds)
    }

    logger.debug({ cacheKey: key, countResult, amount }, "Counter INCR completed")

    return countResult
  }

  /**
   * Get the current count for a given ID without incrementing.
   */
  async getCount(id: string): Promise<number> {
    const key = this.getKey(id)
    const data = await redis.get(key)
    const count = data ? parseInt(data, 10) : 0    
    return count
  }
}
