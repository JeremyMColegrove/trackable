import "server-only"

import { getActiveShareLink } from "@/lib/trackable-share-links"
import { BaseCacheRepository } from "./base-cache.repository"
import { redis } from "./redis-client"

export type CachedSharedForm = NonNullable<
  Awaited<ReturnType<typeof getActiveShareLink>>
>

export class SharedFormCacheRepository extends BaseCacheRepository<CachedSharedForm> {
  constructor() {
    super("shared-form", 3600) // 1 hour TTL
  }

  protected async fetchFallback(
    token: string
  ): Promise<CachedSharedForm | null> {
    const link = await getActiveShareLink(token)
    return link ?? null
  }

  async set(
    token: string,
    entity: CachedSharedForm,
    ttlSeconds: number = this.defaultTtlSeconds
  ): Promise<void> {
    await super.set(token, entity, ttlSeconds)
    if (entity) {
      await this.addToIndex("trackableId", entity.trackableId, token)
      // Also add TTL to index to avoid memory leak if trackable is deleted
      await redis.expire(
        this.getIndexKey("trackableId", entity.trackableId),
        ttlSeconds
      )
    }
  }

  async invalidateForTrackable(trackableId: string): Promise<void> {
    const indexKey = this.getIndexKey("trackableId", trackableId)
    const tokens = await redis.smembers(indexKey)

    if (tokens.length > 0) {
      const keys = tokens.map((token) => this.getKey(token))
      await redis.del(...keys)
      await redis.del(indexKey)
    }
  }

  async invalidateForToken(token: string, trackableId: string): Promise<void> {
    await this.delete(token)
    await this.removeFromIndex("trackableId", trackableId, token)
  }
}

export const sharedFormCache = new SharedFormCacheRepository()
