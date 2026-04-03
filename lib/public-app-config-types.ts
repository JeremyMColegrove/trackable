import type { SubscriptionTier, TierLimits } from "@/server/subscriptions/types"

export interface PublicWorkspaceTierPlan {
  tier: SubscriptionTier
  rank: number
  name: string
  mostPopular: boolean
  priceLabel: string
  priceInterval: string
  summary: string
  highlights: string[]
  lemonSqueezyVariantId: string | null
  manageUrl: string | null
  limits: TierLimits
  tone: "neutral" | "accent" | "strong"
}

export interface PublicAppConfig {
  subscriptionEnforcementEnabled: boolean
  workspaceBillingEnabled: boolean
  workspaceTierPlans: readonly PublicWorkspaceTierPlan[]
}
