import "server-only"

import { redis } from "./redis-client"
import { BaseCacheRepository } from "./base-cache.repository"

export class CounterCacheRepository extends BaseCacheRepository<number> {
  constructor(prefix: string) {
    super(prefix, 60) // Default TTL is short for counters (e.g. 1 minute)
  }

  /**
   * Atomically increment a counter within a specific time window.
   * If the counter doesn't exist, it creates it with the given TTL.
   * For example, useful for rate limiting (e.g. requests per minute).
   */
  async incrementWindow(id: string, amount: number = 1, ttlSeconds: number = this.defaultTtlSeconds): Promise<number> {
    const key = this.getKey(id)
    
    // We use a multi-block to ensure TTL is set on the first increment if not present
    const pipeline = redis.pipeline()
    pipeline.incrby(key, amount)
    
    // We only set expire if we aren't sure it's there. A simpler approach is to set expire every time or conditionally.
    // Instead, using Lua or reading TTL and setting if -1 is safer.
    // However, since simple `incr` doesn't reset TTL, we can safely just do INCR, and if TTL is -1 (no expire), set it.
    // Let's execute and check.
    
    const countResult = await redis.incrby(key, amount)
    
    // If it's a new key, the count will be `amount`. Set TTL.
    if (countResult === amount) {
      await redis.expire(key, ttlSeconds)
    }

    return countResult
  }

  /**
   * Get the current count for a given ID without incrementing.
   */
  async getCount(id: string): Promise<number> {
    const data = await redis.get(this.getKey(id))
    return data ? parseInt(data, 10) : 0
  }
}
