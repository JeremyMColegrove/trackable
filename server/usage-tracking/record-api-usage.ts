import "server-only"

import { randomUUID } from "node:crypto"

import { TRPCError } from "@trpc/server"
import { and, eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { apiKeys, trackableApiUsageEvents, trackableItems } from "@/db/schema"
import type { UsageEventMetadata, UsageEventPayload } from "@/db/schema/types"
import { hashApiKey } from "@/server/api-keys"
import { apiKeyCache } from "@/server/redis/api-key-cache.repository"
import { quotaService } from "@/server/subscriptions/quota.service"
import { logger } from "@/lib/logger"

interface RecordApiUsageInput {
  apiKey: string
  payload: UsageEventPayload
  metadata?: UsageEventMetadata | null
  requestId?: string | null
}

export async function recordApiUsage(input: RecordApiUsageInput) {
  const keyPrefix = input.apiKey.slice(0, 20)
  const secretHash = hashApiKey(input.apiKey)
  const now = new Date()

  const validationData = await apiKeyCache.getValidation(keyPrefix, secretHash)
  
  if (!validationData) {
    logger.warn({ keyPrefix }, "Invalid API key during usage recording.")
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API key.",
    })
  }

  const { apiKey, project } = validationData

  if (apiKey.expiresAt && apiKey.expiresAt <= now) {
    logger.warn({ apiKeyId: apiKey.id, trackableId: project?.id }, "Expired API key used.")
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API key.",
    })
  }

  if (!apiKey.projectId) {
    logger.warn({ apiKeyId: apiKey.id }, "API key not bound to trackable.")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "This API key is not bound to a trackable. Create a new API key for this trackable.",
    })
  }

  if (!project || project.archivedAt) {
    logger.warn({ apiKeyId: apiKey.id, trackableId: apiKey.projectId }, "Trackable not found or archived.")
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Trackable not found.",
    })
  }

  if (project.kind !== "api_ingestion") {
    logger.warn({ apiKeyId: apiKey.id, trackableId: project.id, kind: project.kind }, "Trackable does not accept log events.")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This trackable does not accept log events.",
    })
  }

  const occurredAt = new Date()
  const requestId = input.requestId?.trim() || randomUUID()

  try {
    await quotaService.assertCanLogApiUsage(apiKey.workspaceId)
  } catch (err) {
    logger.warn({ apiKeyId: apiKey.id, workspaceId: apiKey.workspaceId, trackableId: project.id }, "Quota exceeded for logging API usage.")
    throw err
  }

  const [createdUsageEvent] = await db.transaction(async (tx) => {
    const [usageEvent] = await tx
      .insert(trackableApiUsageEvents)
      .values({
        trackableId: project.id,
        apiKeyId: apiKey.id,
        requestId,
        occurredAt,
        payload: input.payload,
        metadata: input.metadata ?? null,
      })
      .returning({
        id: trackableApiUsageEvents.id,
        occurredAt: trackableApiUsageEvents.occurredAt,
      })

    await tx
      .update(trackableItems)
      .set({
        apiUsageCount: sql`${trackableItems.apiUsageCount} + 1`,
        lastApiUsageAt: occurredAt,
        updatedAt: occurredAt,
      })
      .where(eq(trackableItems.id, project.id))

    await tx
      .update(apiKeys)
      .set({
        usageCount: sql`${apiKeys.usageCount} + 1`,
        lastUsedAt: occurredAt,
        updatedAt: occurredAt,
      })
      .where(eq(apiKeys.id, apiKey.id))

    return [usageEvent]
  })

  logger.info({
    apiKeyId: apiKey.id,
    trackableId: project.id,
    requestId,
    eventId: createdUsageEvent.id,
  }, "Recorded API usage successfully.")

  return {
    id: createdUsageEvent.id,
    occurredAt: createdUsageEvent.occurredAt.toISOString(),
    trackable: {
      id: project.id,
      name: project.name,
    },
  }
}
