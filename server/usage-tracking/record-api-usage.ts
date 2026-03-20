import "server-only"

import { randomUUID } from "node:crypto"

import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { apiKeys, trackableApiUsageEvents, trackableItems } from "@/db/schema"
import type { UsageEventMetadata, UsageEventPayload } from "@/db/schema/types"
import { hashApiKey } from "@/server/api-keys"

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
      usageCount: true,
    },
  })

  if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt <= now)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API key.",
    })
  }

  if (!apiKey.projectId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "This API key is not bound to a trackable. Create a new API key for this trackable.",
    })
  }

  const project = await db.query.trackableItems.findFirst({
    where: and(
      eq(trackableItems.id, apiKey.projectId),
      eq(trackableItems.workspaceId, apiKey.workspaceId)
    ),
    columns: {
      id: true,
      kind: true,
      name: true,
      apiUsageCount: true,
      lastApiUsageAt: true,
      archivedAt: true,
    },
  })

  if (!project || project.archivedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Trackable not found.",
    })
  }

  if (project.kind !== "api_ingestion") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This trackable does not accept log events.",
    })
  }

  const occurredAt = new Date()
  const requestId = input.requestId?.trim() || randomUUID()

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
        apiUsageCount: project.apiUsageCount + 1,
        lastApiUsageAt: occurredAt,
        updatedAt: occurredAt,
      })
      .where(eq(trackableItems.id, project.id))

    await tx
      .update(apiKeys)
      .set({
        usageCount: apiKey.usageCount + 1,
        lastUsedAt: occurredAt,
        updatedAt: occurredAt,
      })
      .where(eq(apiKeys.id, apiKey.id))

    return [usageEvent]
  })

  return {
    id: createdUsageEvent.id,
    occurredAt: createdUsageEvent.occurredAt.toISOString(),
    trackable: {
      id: project.id,
      name: project.name,
    },
  }
}
