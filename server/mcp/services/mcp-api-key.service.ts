import "server-only"

import { and, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { apiKeys } from "@/db/schema"
import {
  buildApiKeySecret,
  hashApiKey,
  resolveApiKeyExpiration,
} from "@/server/api-keys"
import { apiKeyCache } from "@/server/redis/api-key-cache.repository"
import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import { McpToolError } from "@/server/mcp/errors/mcp-errors"
import { mcpTrackableService } from "@/server/mcp/services/mcp-trackable.service"

export interface McpApiKeyRecord {
  id: string
  name: string
  lastFour: string
  status: "active" | "revoked"
  expiresAt: string | null
  lastUsedAt: string | null
  usageCount: number
  createdAt: string
}

export interface McpApiKeyCreateResult {
  id: string
  name: string
  status: "active" | "revoked"
  expiresAt: string | null
  plaintextKey: string
}

export class McpApiKeyService {
  private async assertApiIngestionAccess(
    trackableId: string,
    authContext: McpAuthContext
  ) {
    const trackable = await mcpTrackableService.assertAccess(
      trackableId,
      authContext
    )

    if (trackable.kind !== "api_ingestion") {
      throw new McpToolError(
        "FORBIDDEN",
        `Trackable "${trackable.name}" is of kind "${trackable.kind}". Only api_ingestion trackables support API keys.`
      )
    }

    return trackable
  }

  async listApiKeys(
    trackableId: string,
    authContext: McpAuthContext
  ): Promise<{ trackableId: string; keys: McpApiKeyRecord[] }> {
    await this.assertApiIngestionAccess(trackableId, authContext)

    const rows = await db.query.apiKeys.findMany({
      where: eq(apiKeys.projectId, trackableId),
      orderBy: [desc(apiKeys.createdAt)],
      columns: {
        id: true,
        name: true,
        lastFour: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
      },
    })

    return {
      trackableId,
      keys: rows.map((row) => ({
        id: row.id,
        name: row.name,
        lastFour: row.lastFour,
        status: row.status,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
        usageCount: row.usageCount,
        createdAt: row.createdAt.toISOString(),
      })),
    }
  }

  async createApiKey(
    trackableId: string,
    input: {
      name: string
      expirationPreset: "never" | "30_days" | "60_days" | "90_days"
    },
    authContext: McpAuthContext
  ): Promise<McpApiKeyCreateResult> {
    const trackable = await this.assertApiIngestionAccess(
      trackableId,
      authContext
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

  async revokeApiKey(
    trackableId: string,
    apiKeyId: string,
    authContext: McpAuthContext
  ): Promise<{ id: string; status: "active" | "revoked" }> {
    await this.assertApiIngestionAccess(trackableId, authContext)

    const existingKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, apiKeyId), eq(apiKeys.projectId, trackableId)),
      columns: {
        id: true,
        status: true,
        keyPrefix: true,
        secretHash: true,
      },
    })

    if (!existingKey) {
      throw new McpToolError("NOT_FOUND", "API key not found.")
    }

    if (existingKey.status === "revoked") {
      return { id: existingKey.id, status: "revoked" }
    }

    const [revokedKey] = await db
      .update(apiKeys)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(apiKeys.id, existingKey.id))
      .returning({ id: apiKeys.id, status: apiKeys.status })

    await apiKeyCache.invalidateValidation(
      existingKey.keyPrefix,
      existingKey.secretHash
    )

    return { id: revokedKey.id, status: revokedKey.status }
  }
}

export const mcpApiKeyService = new McpApiKeyService()
