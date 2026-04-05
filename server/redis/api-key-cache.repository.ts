import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { apiKeys, trackableItems } from "@/db/schema"
import { BaseCacheRepository } from "./base-cache.repository"

export type CachedApiKeyValidation = {
  apiKey: {
    id: string
    workspaceId: string
    projectId: string | null
    expiresAt: Date | null
    name: string
    keyPrefix: string
    lastFour: string
  }
  project: {
    id: string
    kind: string
    name: string
    archivedAt: Date | null
  } | null
}

export class ApiKeyCacheRepository extends BaseCacheRepository<CachedApiKeyValidation> {
  constructor() {
    super("api-key-validation", 300) // 5 minutes TTL
  }

  protected async fetchFallback(
    combinedId: string
  ): Promise<CachedApiKeyValidation | null> {
    const [keyPrefix, secretHash] = combinedId.split(":")

    const apiKey = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.keyPrefix, keyPrefix),
        eq(apiKeys.secretHash, secretHash),
        eq(apiKeys.status, "active")
      ),
      columns: {
        id: true,
        workspaceId: true,
        projectId: true,
        expiresAt: true,
        name: true,
        keyPrefix: true,
        lastFour: true,
      },
    })

    if (!apiKey) return null

    let project = null
    if (apiKey.projectId) {
      const dbProject = await db.query.trackableItems.findFirst({
        where: and(
          eq(trackableItems.id, apiKey.projectId),
          eq(trackableItems.workspaceId, apiKey.workspaceId)
        ),
        columns: {
          id: true,
          kind: true,
          name: true,
          archivedAt: true,
        },
      })
      if (dbProject) project = dbProject
    }

    return { apiKey, project }
  }

  async getValidation(
    keyPrefix: string,
    secretHash: string
  ): Promise<CachedApiKeyValidation | null> {
    return this.get(`${keyPrefix}:${secretHash}`)
  }

  async invalidateValidation(
    keyPrefix: string,
    secretHash: string
  ): Promise<void> {
    await this.delete(`${keyPrefix}:${secretHash}`)
  }
}

export const apiKeyCache = new ApiKeyCacheRepository()
