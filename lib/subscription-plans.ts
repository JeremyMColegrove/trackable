import type { SubscriptionTier, TierLimits } from "@/server/subscriptions/types"

export interface SubscriptionPlanDefinition {
  tier: SubscriptionTier
  rank: number
  lemonSqueezyVariantId: string | null
  limits: TierLimits
}

const FREE_LIMITS: TierLimits = {
  maxTrackableItems: 10,
  maxResponsesPerSurvey: 100,
  maxWorkspaceMembers: 5,
  maxApiLogsPerMinute: 30,
  logRetentionDays: 3,
}

const PLUS_LIMITS: TierLimits = {
  maxTrackableItems: 100,
  maxResponsesPerSurvey: null,
  maxWorkspaceMembers: 100,
  maxApiLogsPerMinute: 60,
  logRetentionDays: 90,
}

const PRO_LIMITS: TierLimits = {
  maxTrackableItems: null,
  maxResponsesPerSurvey: null,
  maxWorkspaceMembers: null,
  maxApiLogsPerMinute: 600,
  logRetentionDays: null,
}

const SUBSCRIPTION_PLAN_LIST: SubscriptionPlanDefinition[] = [
  {
    tier: "free",
    rank: 0,
    lemonSqueezyVariantId: null,
    limits: FREE_LIMITS,
  },
  {
    tier: "plus",
    rank: 1,
    lemonSqueezyVariantId: "12345",
    limits: PLUS_LIMITS,
  },
  {
    tier: "pro",
    rank: 2,
    lemonSqueezyVariantId: "67890",
    limits: PRO_LIMITS,
  },
]

const SUBSCRIPTION_PLANS = SUBSCRIPTION_PLAN_LIST.reduce(
  (plans, plan) => {
    plans[plan.tier] = plan
    return plans
  },
  {} as Record<SubscriptionTier, SubscriptionPlanDefinition>
)

const TIER_RANKS = SUBSCRIPTION_PLAN_LIST.reduce(
  (ranks, plan) => {
    ranks[plan.tier] = plan.rank
    return ranks
  },
  {} as Record<SubscriptionTier, number>
)

export function getSubscriptionPlans(): readonly SubscriptionPlanDefinition[] {
  return [...SUBSCRIPTION_PLAN_LIST].sort(
    (left, right) => left.rank - right.rank
  )
}

export function getSubscriptionPlan(
  tier: SubscriptionTier
): SubscriptionPlanDefinition {
  return SUBSCRIPTION_PLANS[tier]
}

export function getLimitsForTier(tier: SubscriptionTier): TierLimits {
  return getSubscriptionPlan(tier).limits
}

export function resolveTierFromVariantId(
  variantId: string
): SubscriptionTier | null {
  const matchingPlan = SUBSCRIPTION_PLAN_LIST.find(
    (plan) => plan.lemonSqueezyVariantId === variantId
  )

  return matchingPlan?.tier ?? null
}

export function isTierAtLeast(
  current: SubscriptionTier,
  required: SubscriptionTier
): boolean {
  return TIER_RANKS[current] >= TIER_RANKS[required]
}
