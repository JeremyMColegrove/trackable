import type { SubscriptionTier, TierLimits } from "@/server/subscriptions/types"
import {
  getLimitsForTier,
  getSubscriptionPlan,
  resolveTierFromVariantId,
} from "@/lib/subscription-plans"

export interface WorkspaceTierPlan {
  tier: SubscriptionTier
  rank: number
  name: string
  mostPopular: boolean
  priceLabel: string
  priceInterval: string
  summary: string
  highlights: string[]
  lemonSqueezyVariantId: string | null
  switchUrl: string | null
  manageUrl: string | null
  limits: TierLimits
  tone: "neutral" | "accent" | "strong"
}

export const WORKSPACE_BILLING_ENABLED = false

function formatUsageLimit(
  value: number | null,
  singularLabel: string | React.ReactNode,
  pluralLabel: string | React.ReactNode
) {
  return value === null
    ? `Unlimited ${pluralLabel}`
    : `${value} ${value === 1 ? singularLabel : pluralLabel}`
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

const WORKSPACE_TIER_PLAN_LIST: WorkspaceTierPlan[] = [
  {
    ...getSubscriptionPlan("free"),
    tier: "free",
    name: "Free",
    mostPopular: false,
    priceLabel: "$0",
    priceInterval: "/workspace",
    summary: "A clean starting point for new workspaces.",
    highlights: buildTierHighlights(getLimitsForTier("free")),
    switchUrl:
      "https://store.trackables.org/checkout/buy/500a54dd-0570-4265-a2a3-d09adacd156a",
    manageUrl: "https://store.trackables.org/billing",
    tone: "neutral",
  },
  {
    ...getSubscriptionPlan("plus"),
    tier: "plus",
    name: "Plus",
    mostPopular: true,
    priceLabel: "$24",
    priceInterval: "/workspace",
    summary: "More room for growing teams and heavier usage.",
    highlights: buildTierHighlights(getLimitsForTier("plus")),
    switchUrl:
      "https://store.trackables.org/checkout/buy/500a54dd-0570-4265-a2a3-d09adacd156a",
    manageUrl: "https://store.trackables.org/billing",
    tone: "accent",
  },
  {
    ...getSubscriptionPlan("pro"),
    tier: "pro",
    name: "Pro",
    mostPopular: false,
    priceLabel: "$79",
    priceInterval: "/workspace",
    summary: "Expanded limits for high-volume workspaces.",
    highlights: buildTierHighlights(getLimitsForTier("pro")),
    switchUrl:
      "https://store.trackables.org/checkout/buy/500a54dd-0570-4265-a2a3-d09adacd156a",
    manageUrl: "https://store.trackables.org/billing",
    tone: "strong",
  },
]

export const WORKSPACE_TIER_PLANS = WORKSPACE_TIER_PLAN_LIST.reduce(
  (plans, plan) => {
    plans[plan.tier] = plan
    return plans
  },
  {} as Record<SubscriptionTier, WorkspaceTierPlan>
)

export const WORKSPACE_TIER_ORDER = WORKSPACE_TIER_PLAN_LIST.map((plan) => plan)
  .sort((left, right) => left.rank - right.rank)
  .map((plan) => plan.tier)

export function getWorkspaceTierPlans(): readonly WorkspaceTierPlan[] {
  return [...WORKSPACE_TIER_PLAN_LIST].sort(
    (left, right) => left.rank - right.rank
  )
}

export function getWorkspaceTierPlan(
  tier: SubscriptionTier
): WorkspaceTierPlan {
  return WORKSPACE_TIER_PLANS[tier]
}

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return getLimitsForTier(tier)
}

export function resolveWorkspaceTierFromLemonSqueezyVariantId(
  variantId: string
): SubscriptionTier | null {
  return resolveTierFromVariantId(variantId)
}
