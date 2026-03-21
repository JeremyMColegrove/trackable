import "server-only"

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
   * Fetch an entity from the cache by ID.
   */
  async get(id: string): Promise<T | null> {
    const data = await redis.get(this.getKey(id))
    if (!data) return null

    try {
      return JSON.parse(data) as T
    } catch {
      return null
    }
  }

  /**
   * Fetch multiple entities by their IDs.
   */
  async mget(ids: string[]): Promise<Array<T | null>> {
    if (ids.length === 0) return []
    const keys = ids.map((id) => this.getKey(id))
    const results = await redis.mget(keys)

    return results.map((data) => {
      if (!data) return null
      try {
        return JSON.parse(data) as T
      } catch {
        return null
      }
    })
  }

  /**
   * Set an entity in the cache.
   */
  async set(id: string, entity: T, ttlSeconds: number = this.defaultTtlSeconds): Promise<void> {
    const data = JSON.stringify(entity)
    await redis.set(this.getKey(id), data, "EX", ttlSeconds)
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
    if (!current) return null

    const updated = { ...current, ...partial }
    await this.set(id, updated, ttlSeconds)
    return updated
  }

  /**
   * Delete an entity from the cache.
   */
  async delete(id: string): Promise<void> {
    await redis.del(this.getKey(id))
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
    const ids = await redis.smembers(this.getIndexKey(indexName, value))
    if (ids.length === 0) return []

    const entities = await this.mget(ids)
    return entities.filter((e): e is T => e !== null)
  }
}
