import {
  getLimitsForTier,
  getSubscriptionPlan,
  resolveTierFromVariantId,
} from "@/lib/subscription-plans"
import type { PublicWorkspaceTierPlan } from "@/lib/public-app-config-types"
import { getRuntimeConfig } from "@/lib/runtime-config"
import type { SubscriptionTier, TierLimits } from "@/server/subscriptions/types"

export type WorkspaceTierPlan = PublicWorkspaceTierPlan

function formatUsageLimit(
  value: number | null,
  singularLabel: string | React.ReactNode,
  pluralLabel: string | React.ReactNode
) {
  return value === null
    ? `Unlimited ${pluralLabel}`
    : `${value} ${value === 1 ? singularLabel : pluralLabel}`
}

function formatByteLimit(value: number | null) {
  if (value === null) {
    return "Unlimited API payload size"
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB API payload size`
  }

  return `${value} byte API payload size`
}

function buildTierHighlights(limits: TierLimits): string[] {
  return [
    formatUsageLimit(
      limits.maxWorkspaceMembers,
      "workspace member",
      "workspace members"
    ),
    formatUsageLimit(
      limits.maxTrackableItems,
      "active trackable",
      "active trackables"
    ),
    formatUsageLimit(
      limits.maxResponsesPerSurvey,
      "response per survey",
      "responses per survey"
    ),
    formatByteLimit(limits.maxApiPayloadBytes),
    formatUsageLimit(
      limits.maxApiLogsPerMinute,
      "API log per minute",
      "API logs per minute"
    ),
    limits.logRetentionDays === null
      ? "Unlimited API log retention"
      : `${limits.logRetentionDays}-day API log retention`,
  ]
}

export function getWorkspaceTierPlans(): readonly WorkspaceTierPlan[] {
  return [...buildWorkspaceTierPlanList()].sort(
    (left, right) => left.rank - right.rank
  )
}

export function getWorkspaceTierPlan(
  tier: SubscriptionTier
): WorkspaceTierPlan {
  return buildWorkspaceTierPlansByTier()[tier]
}

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return getLimitsForTier(tier)
}

export function resolveWorkspaceTierFromLemonSqueezyVariantId(
  variantId: string
): SubscriptionTier | null {
  return resolveTierFromVariantId(variantId)
}

export function getWorkspaceBillingEnabled() {
  return getRuntimeConfig().features.workspaceBillingEnabled
}

function buildWorkspaceTierPlanList(): WorkspaceTierPlan[] {
  const runtimeConfig = getRuntimeConfig()

  return runtimeConfig.subscriptionTiers.plans.map((plan) => {
    const subscriptionPlan = getSubscriptionPlan(plan.tier)

    return {
      ...subscriptionPlan,
      name: plan.display.name,
      mostPopular: plan.display.mostPopular,
      priceLabel: plan.display.priceLabel,
      priceInterval: plan.display.priceInterval,
      summary: plan.display.summary,
      highlights: buildTierHighlights(getLimitsForTier(plan.tier)),
      manageUrl: runtimeConfig.billing.manageUrl,
      tone: plan.display.tone,
    }
  })
}

function buildWorkspaceTierPlansByTier() {
  return buildWorkspaceTierPlanList().reduce(
    (plans, plan) => {
      plans[plan.tier] = plan
      return plans
    },
    {} as Record<SubscriptionTier, WorkspaceTierPlan>
  )
}
