import {
  getBillingTierById,
  getLimitsEntries,
  getLimitsForTier,
  getDefaultTierId,
  resolveTierFromVariantId,
} from "@/lib/subscription-plans"
import type { PublicWorkspacePlan } from "@/lib/public-app-config-types"
import { getRuntimeConfig } from "@/lib/runtime-config"
import type { TierLimits } from "@/server/subscriptions/types"

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

/**
 * Returns all workspace plans (limits entries that have a linked billing tier),
 * sorted by rank. Each plan combines billing tier display info with computed
 * limits highlights.
 */
export function getWorkspaceTierPlans(): readonly PublicWorkspacePlan[] {
  const runtimeConfig = getRuntimeConfig()
  const entries = getLimitsEntries()

  const plans: PublicWorkspacePlan[] = []

  for (const [index, entry] of entries.entries()) {
    if (entry.billingTier === null) continue

    const billingTier = getBillingTierById(entry.billingTier)
    if (!billingTier) continue

    const limits = getLimitsForTier(entry.id)

    plans.push({
      tierId: entry.id,
      billingTierId: billingTier.id,
      rank: index,
      name: billingTier.name,
      description: billingTier.description,
      priceLabel: billingTier.priceLabel,
      priceInterval: billingTier.priceInterval,
      mostPopular: billingTier.mostPopular,
      tone: billingTier.tone,
      lemonSqueezyVariantId: billingTier.lemonSqueezyVariantId,
      highlights: buildTierHighlights(limits),
      limits,
      manageUrl: runtimeConfig.billing.manageUrl,
    })
  }

  if (plans.length === 0) {
    const defaultEntry = entries[0]
    const limits = getLimitsForTier(defaultEntry.id)

    return [
      {
        tierId: "free",
        billingTierId: null,
        rank: 0,
        name: "Free",
        description: "A clean starting point for new workspaces.",
        priceLabel: "$0",
        priceInterval: "/workspace",
        mostPopular: false,
        tone: "neutral",
        lemonSqueezyVariantId: null,
        highlights: buildTierHighlights(limits),
        limits,
        manageUrl: runtimeConfig.billing.manageUrl,
      },
    ]
  }

  return plans
}

export function getWorkspaceTierPlan(
  tierId: string
): PublicWorkspacePlan | undefined {
  return getWorkspaceTierPlans().find((plan) => plan.tierId === tierId)
}

export function getTierLimits(tierId: string): TierLimits {
  return getLimitsForTier(tierId)
}

export function resolveWorkspaceTierFromLemonSqueezyVariantId(
  variantId: string
): string | null {
  return resolveTierFromVariantId(variantId)
}

export function getWorkspaceBillingEnabled() {
  return getRuntimeConfig().features.workspaceBillingEnabled
}
