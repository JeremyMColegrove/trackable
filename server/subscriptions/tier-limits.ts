import type { SubscriptionTier, TierLimits } from "@/server/subscriptions/types"

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxTrackableItems: 10,
    maxResponsesPerSurvey: 100,
    maxWorkspaceMembers: 2,
    maxApiLogsPerMinute: 60,
    logRetentionDays: 3,
  },
  plus: {
    maxTrackableItems: 100,
    maxResponsesPerSurvey: null,
    maxWorkspaceMembers: 100,
    maxApiLogsPerMinute: 600,
    logRetentionDays: 90,
  },
  pro: {
    maxTrackableItems: null,
    maxResponsesPerSurvey: null,
    maxWorkspaceMembers: null,
    maxApiLogsPerMinute: null,
    logRetentionDays: null,
  },
}

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier]
}
