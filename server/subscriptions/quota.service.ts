import "server-only"

import { TRPCError } from "@trpc/server"
import { and, count, eq, gte, isNull } from "drizzle-orm"

import { db } from "@/db"
import {
  trackableApiUsageEvents,
  trackableFormSubmissions,
  trackableItems,
  workspaceMembers,
} from "@/db/schema"
import { subscriptionService } from "@/server/subscriptions/subscription.service"
import { areTiersUnlocked } from "@/server/subscriptions/tiers-unlocked"

export class QuotaService {
  async assertCanCreateTrackable(workspaceId: string) {
    if (areTiersUnlocked()) {
      return
    }

    const limits = await subscriptionService.getWorkspaceLimits(workspaceId)

    if (limits.maxTrackableItems === null) {
      return
    }

    const [result] = await db
      .select({ count: count() })
      .from(trackableItems)
      .where(
        and(
          eq(trackableItems.workspaceId, workspaceId),
          isNull(trackableItems.archivedAt)
        )
      )

    if (result.count >= limits.maxTrackableItems) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You have reached the maximum of ${limits.maxTrackableItems} trackable items for your plan. Please upgrade to create more.`,
      })
    }
  }

  async assertCanSubmitResponse(trackableId: string) {
    if (areTiersUnlocked()) {
      return
    }

    const trackable = await db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, trackableId),
      columns: {
        workspaceId: true,
        kind: true,
      },
    })

    if (!trackable || trackable.kind !== "survey") {
      return
    }

    const limits = await subscriptionService.getWorkspaceLimits(
      trackable.workspaceId
    )

    if (limits.maxResponsesPerSurvey === null) {
      return
    }

    const [result] = await db
      .select({ count: count() })
      .from(trackableFormSubmissions)
      .where(eq(trackableFormSubmissions.trackableId, trackableId))

    if (result.count >= limits.maxResponsesPerSurvey) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This survey has reached the maximum of ${limits.maxResponsesPerSurvey} responses for its plan. The workspace owner can upgrade to collect more.`,
      })
    }
  }

  async assertCanAddWorkspaceMember(workspaceId: string) {
    if (areTiersUnlocked()) {
      return
    }

    const limits = await subscriptionService.getWorkspaceLimits(workspaceId)

    if (limits.maxWorkspaceMembers === null) {
      return
    }

    const [result] = await db
      .select({ count: count() })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          isNull(workspaceMembers.revokedAt)
        )
      )

    if (result.count >= limits.maxWorkspaceMembers) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This workspace has reached the maximum of ${limits.maxWorkspaceMembers} members for its plan. Please upgrade to invite more.`,
      })
    }
  }

  async assertCanLogApiUsage(workspaceId: string) {
    if (areTiersUnlocked()) {
      return
    }

    const limits = await subscriptionService.getWorkspaceLimits(workspaceId)

    if (limits.maxApiLogsPerMinute === null) {
      return
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000)

    const [result] = await db
      .select({ count: count() })
      .from(trackableApiUsageEvents)
      .innerJoin(
        trackableItems,
        eq(trackableApiUsageEvents.trackableId, trackableItems.id)
      )
      .where(
        and(
          eq(trackableItems.workspaceId, workspaceId),
          gte(trackableApiUsageEvents.occurredAt, oneMinuteAgo)
        )
      )

    if (result.count >= limits.maxApiLogsPerMinute) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Rate limit exceeded: maximum ${limits.maxApiLogsPerMinute} API logs per minute for your plan. Please upgrade for higher limits.`,
      })
    }
  }

  async getEffectiveLogRetentionDays(
    workspaceId: string
  ): Promise<number | null> {
    if (areTiersUnlocked()) {
      return null
    }

    const limits = await subscriptionService.getWorkspaceLimits(workspaceId)
    return limits.logRetentionDays
  }
}

export const quotaService = new QuotaService()
