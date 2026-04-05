import "server-only"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { apiKeys } from "@/db/schema"
import {
  buildApiKeySecret,
  hashApiKey,
  resolveApiKeyExpiration,
} from "@/server/api-keys"
import { accessControlService } from "@/server/services/access-control.service"
import { apiKeyCache } from "@/server/redis/api-key-cache.repository"
import { assertTrackableKind } from "@/server/services/trackable-kind"

export class ApiKeyService {
  async createApiKey(input: {
    trackableId: string
    userId: string
    name: string
    expirationPreset: "never" | "30_days" | "60_days" | "90_days"
  }) {
    const trackable = await accessControlService.assertTrackableAccess(
      input.trackableId,
      input.userId,
      "manage"
    )

    assertTrackableKind(
      trackable.kind,
      "api_ingestion",
      "Only log trackables can create API keys."
    )

    const plaintextKey = buildApiKeySecret()
    const expiresAt = resolveApiKeyExpiration(input.expirationPreset)

    const [createdKey] = await db
      .insert(apiKeys)
      .values({
        workspaceId: trackable.workspaceId,
        projectId: trackable.id,
        name: input.name,
        keyPrefix: plaintextKey.slice(0, 20),
        secretHash: hashApiKey(plaintextKey),
        lastFour: plaintextKey.slice(-4),
        expiresAt,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        status: apiKeys.status,
        expiresAt: apiKeys.expiresAt,
      })

    return {
      id: createdKey.id,
      name: createdKey.name,
      status: createdKey.status,
      expiresAt: createdKey.expiresAt?.toISOString() ?? null,
      plaintextKey,
    }
  }

  async revokeApiKey(input: {
    trackableId: string
    userId: string
    apiKeyId: string
  }) {
    await accessControlService.assertTrackableAccess(
      input.trackableId,
      input.userId,
      "manage"
    )

    const existingKey = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.id, input.apiKeyId),
        eq(apiKeys.projectId, input.trackableId)
      ),
      columns: {
        id: true,
        status: true,
        keyPrefix: true,
        secretHash: true,
      },
    })

    if (!existingKey) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "API key not found.",
      })
    }

    if (existingKey.status === "revoked") {
      return existingKey
    }

    const [revokedKey] = await db
      .update(apiKeys)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, existingKey.id))
      .returning({
        id: apiKeys.id,
        status: apiKeys.status,
      })

    await apiKeyCache.invalidateValidation(
      existingKey.keyPrefix,
      existingKey.secretHash
    )

    return revokedKey
  }
}

export const apiKeyService = new ApiKeyService()
