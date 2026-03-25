import "server-only"

import superjson from "superjson"

import { logger } from "@/lib/logger"
import { redis } from "./redis-client"

export abstract class BaseCacheRepository<T> {
  protected constructor(
    protected readonly prefix: string,
    protected readonly defaultTtlSeconds: number = 3600
  ) {}

  protected getKey(id: string): string {
    return `${this.prefix}:${id}`
  }

  protected getIndexKey(indexName: string, value: string): string {
    return `${this.prefix}:idx:${indexName}:${value}`
  }

  /**
   * Implement this method in subclasses to provide the DB fallback logic when a cache miss occurs.
   * If the entity does not exist in the database, return null.
   */
  protected abstract fetchFallback(id: string): Promise<T | null>

  /**
   * Fetch an entity from the cache by ID, without invoking the DB fallback if missed.
   */
  async getRaw(id: string): Promise<T | null> {
    const key = this.getKey(id)
    const data = await redis.get(key)
    if (!data) {
      return null
    }

    try {
      const parsed = superjson.parse(data) as T
      logger.info({ cacheKey: key }, "Cache HIT")
      return parsed
    } catch (err) {
      logger.error({ cacheKey: key, error: err }, "Failed to parse cache entry")
      return null
    }
  }

  /**
   * Fetch an entity from the cache by ID. If missed, invokes DB fallback.
   */
  async get(id: string): Promise<T | null> {
    const cached = await this.getRaw(id)
    if (cached !== null) {
      return cached
    }

    // Cache miss: fall back to the implemented DB method
    const start = Date.now()
    const fallbackData = await this.fetchFallback(id)
    const durationMs = Date.now() - start
    
    logger.debug({ cacheKey: this.getKey(id), durationMs, hasData: fallbackData !== null }, "Cache fallback executed")

    if (fallbackData !== null) {
      await this.set(id, fallbackData)
    }
    return fallbackData
  }

  /**
   * Fetch multiple entities by their IDs.
   */
  async mget(ids: string[]): Promise<Array<T | null>> {
    if (ids.length === 0) return []
    const keys = ids.map((id) => this.getKey(id))
    const results = await redis.mget(keys)

    let hits = 0
    let misses = 0

    const entities = results.map((data, idx) => {
      if (!data) {
        misses++
        return null
      }
      try {
        hits++
        return superjson.parse(data) as T
      } catch (err) {
        logger.error({ cacheKey: keys[idx], error: err }, "Failed to parse mget cache entry")
        misses++
        return null
      }
    })

    logger.debug({ prefix: this.prefix, keysCount: keys.length, hits, misses }, "Cache MGET completed")
    return entities
  }

  /**
   * Set an entity in the cache.
   */
  async set(id: string, entity: T, ttlSeconds: number = this.defaultTtlSeconds): Promise<void> {
    const data = superjson.stringify(entity)
    const key = this.getKey(id)
    try {
      await redis.set(key, data, "EX", ttlSeconds)
      logger.debug({ cacheKey: key, ttlSeconds }, "Cache SET completed")
    } catch (err) {
      logger.error({ cacheKey: key, error: err }, "Cache SET failed")
      throw err
    }
  }

  /**
   * Update an entity in the cache without replacing it entirely.
   * Merges the partial data into the existing entity and resets the TTL.
   * If the entity does not exist, returns null.
   */
  async update(
    id: string,
    partial: Partial<T>,
    ttlSeconds: number = this.defaultTtlSeconds
  ): Promise<T | null> {
    const current = await this.get(id)
    if (!current) {
      logger.debug({ cacheKey: this.getKey(id) }, "Cache UPDATE aborted (entity not found)")
      return null
    }

    const updated = { ...current, ...partial }
    await this.set(id, updated, ttlSeconds)
    return updated
  }

  /**
   * Delete an entity from the cache.
   */
  async delete(id: string): Promise<void> {
    const key = this.getKey(id)
    await redis.del(key)
    logger.debug({ cacheKey: key }, "Cache DELETE completed")
  }

  // --- Secondary Index Mapping (Sets) ---

  /**
   * Add an entity ID to a secondary index.
   */
  async addToIndex(indexName: string, value: string, id: string): Promise<void> {
    await redis.sadd(this.getIndexKey(indexName, value), id)
  }

  /**
   * Remove an entity ID from a secondary index.
   */
  async removeFromIndex(indexName: string, value: string, id: string): Promise<void> {
    await redis.srem(this.getIndexKey(indexName, value), id)
  }

  /**
   * Find all entity IDs for a specific index value and return the parsed entities.
   */
  async findByIndex(indexName: string, value: string): Promise<T[]> {
    const indexKey = this.getIndexKey(indexName, value)
    const ids = await redis.smembers(indexKey)
    if (ids.length === 0) {
      logger.debug({ indexKey }, "Cache INDEX search returned empty")
      return []
    }

    const entities = await this.mget(ids)
    return entities.filter((e): e is T => e !== null)
  }
}
