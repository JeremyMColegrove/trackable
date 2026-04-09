import type { TierLimits } from "@/server/subscriptions/types"

export interface PublicWorkspacePlan {
  /** Limits entry ID — stored in the DB as the workspace tier. */
  tierId: string
  /** Billing tier ID this plan is linked to (null for unlinked default entries). */
  billingTierId: string | null
  /** Sort rank (0 = lowest). Derived from position in limits array. */
  rank: number
  name: string
  description: string
  priceLabel: string
  priceInterval: string
  mostPopular: boolean
  tone: "neutral" | "accent" | "strong"
  lemonSqueezyVariantId: string | null
  /** Human-readable bullet points derived from the limits. */
  highlights: string[]
  limits: TierLimits
  manageUrl: string | null
}

export interface PublicAppConfig {
  authEmailServiceEnabled: boolean
  subscriptionEnforcementEnabled: boolean
  workspaceBillingEnabled: boolean
  /** All workspace plans, sorted by rank. Includes only limits entries that have a linked billing tier. */
  workspacePlans: readonly PublicWorkspacePlan[]
  /** The default (lowest/free) tier ID — applied when a workspace has no subscription. */
  defaultTierId: string
  /** Whether custom MCP server tokens are enabled (self-hosted auth). */
  customMCPServerTokens: boolean
}

/** @deprecated Use PublicWorkspacePlan */
export type PublicWorkspaceTierPlan = PublicWorkspacePlan
