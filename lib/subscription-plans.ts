import type { SubscriptionTier, TierLimits } from "@/server/subscriptions/types"
import { getRuntimeConfig } from "@/lib/runtime-config"

export interface FreeTierUserLimits {
  maxCreatedWorkspaces: number | null
}

export interface SubscriptionPlanDefinition {
  tier: SubscriptionTier
  rank: number
  lemonSqueezyVariantId: string | null
  limits: TierLimits
}

export function getSubscriptionPlans(): readonly SubscriptionPlanDefinition[] {
  return [...buildSubscriptionPlanList()].sort(
    (left, right) => left.rank - right.rank
  )
}

export function getSubscriptionPlan(
  tier: SubscriptionTier
): SubscriptionPlanDefinition {
  return buildSubscriptionPlansByTier()[tier]
}

export function getLimitsForTier(tier: SubscriptionTier): TierLimits {
  return getSubscriptionPlan(tier).limits
}

export function getFreeTierUserLimits(): FreeTierUserLimits {
  return getRuntimeConfig().subscriptionTiers.freeTierUserLimits
}

export function getFreeTierCreatedWorkspaceLimit(): number | null {
  return getFreeTierUserLimits().maxCreatedWorkspaces
}

export function resolveTierFromVariantId(
  variantId: string
): SubscriptionTier | null {
  const matchingPlan = buildSubscriptionPlanList().find(
    (plan) => plan.lemonSqueezyVariantId === variantId
  )

  return matchingPlan?.tier ?? null
}

export function isTierAtLeast(
  current: SubscriptionTier,
  required: SubscriptionTier
): boolean {
  const tierRanks = buildTierRanks()
  return tierRanks[current] >= tierRanks[required]
}

function buildSubscriptionPlanList(): SubscriptionPlanDefinition[] {
  return getRuntimeConfig().subscriptionTiers.plans.map((plan) => ({
    tier: plan.tier,
    rank: plan.rank,
    lemonSqueezyVariantId: plan.lemonSqueezyVariantId,
    limits: plan.limits,
  }))
}

function buildSubscriptionPlansByTier() {
  return buildSubscriptionPlanList().reduce(
    (plans, plan) => {
      plans[plan.tier] = plan
      return plans
    },
    {} as Record<SubscriptionTier, SubscriptionPlanDefinition>
  )
}

function buildTierRanks() {
  return buildSubscriptionPlanList().reduce(
    (ranks, plan) => {
      ranks[plan.tier] = plan.rank
      return ranks
    },
    {} as Record<SubscriptionTier, number>
  )
}
