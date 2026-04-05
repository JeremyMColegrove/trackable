import "server-only"

import { TRPCError } from "@trpc/server"
import { and, count, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import type { UsageEventPayload } from "@/db/schema/types"
import {
  trackableFormSubmissions,
  trackableItems,
  workspaceMembers,
} from "@/db/schema"
import {
  getApiLogRateLimitMessage,
  getApiPayloadSizeLimitMessage,
  getSurveyResponseLimitMessage,
  getTrackableLimitMessage,
  getWorkspaceMemberLimitMessage,
} from "@/lib/subscription-limit-messages"
import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement"
import { LimitReachedError } from "@/server/errors"
import { CounterCacheRepository } from "@/server/redis/counter-cache.repository"
import { getUsagePayloadSizeBytes } from "@/server/subscriptions/quota-limit-utils"
import { subscriptionService } from "@/server/subscriptions/subscription-service.singleton"

const apiLogsRateLimitCache = new CounterCacheRepository("api-logs-rate-limit")

export class QuotaService {
  async assertCanCreateTrackable(workspaceId: string) {
    if (!isSubscriptionEnforcementEnabled()) {
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

    if (Number(result.count) >= limits.maxTrackableItems) {
      throw new LimitReachedError(getTrackableLimitMessage(limits.maxTrackableItems))
    }
  }

  async assertSurveyCanAcceptResponses(trackableId: string) {
    if (!isSubscriptionEnforcementEnabled()) {
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

    if (Number(result.count) >= limits.maxResponsesPerSurvey) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: getSurveyResponseLimitMessage(limits.maxResponsesPerSurvey),
      })
    }
  }

  async assertCanSubmitResponse(trackableId: string) {
    await this.assertSurveyCanAcceptResponses(trackableId)
  }

  async assertCanAddWorkspaceMember(workspaceId: string) {
    if (!isSubscriptionEnforcementEnabled()) {
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

    if (Number(result.count) >= limits.maxWorkspaceMembers) {
      throw new LimitReachedError(getWorkspaceMemberLimitMessage(limits.maxWorkspaceMembers))
    }
  }

  async assertApiPayloadSize(
    workspaceId: string,
    payload: UsageEventPayload,
    payloadSizeBytes = getUsagePayloadSizeBytes(payload)
  ) {
    if (!isSubscriptionEnforcementEnabled()) {
      return
    }

    const limits = await subscriptionService.getWorkspaceLimits(workspaceId)

    if (limits.maxApiPayloadBytes === null) {
      return
    }

    if (payloadSizeBytes > limits.maxApiPayloadBytes) {
      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message: getApiPayloadSizeLimitMessage(limits.maxApiPayloadBytes),
      })
    }
  }

  async assertCanLogApiUsage(workspaceId: string) {
    if (!isSubscriptionEnforcementEnabled()) {
      return
    }

    const limits = await subscriptionService.getWorkspaceLimits(workspaceId)

    if (limits.maxApiLogsPerMinute === null) {
      return
    }

    const currentMinute = Math.floor(Date.now() / 60_000)
    const counterKey = `${workspaceId}:${currentMinute}`
    const count = await apiLogsRateLimitCache.incrementWindow(counterKey, 1, 60)

    if (count > limits.maxApiLogsPerMinute) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: getApiLogRateLimitMessage(limits.maxApiLogsPerMinute),
      })
    }
  }

  async getEffectiveLogRetentionDays(
    workspaceId: string
  ): Promise<number | null> {
    if (!isSubscriptionEnforcementEnabled()) {
      return null
    }

    const limits = await subscriptionService.getWorkspaceLimits(workspaceId)
    return limits.logRetentionDays
  }
}

export const quotaService = new QuotaService()
