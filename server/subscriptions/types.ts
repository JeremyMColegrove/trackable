export type SubscriptionTier = "free" | "plus" | "pro"
export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "paused"
  | "past_due"

export interface TierLimits {
  /** Maximum trackable items per workspace. `null` = unlimited. */
  maxTrackableItems: number | null
  /** Maximum form responses per survey trackable. `null` = unlimited. */
  maxResponsesPerSurvey: number | null
  /** Maximum active members per workspace. `null` = unlimited. */
  maxWorkspaceMembers: number | null
  /** Maximum API log events per minute per workspace. `null` = unlimited. */
  maxApiLogsPerMinute: number | null
  /** Maximum log retention in days. `null` = forever. */
  logRetentionDays: number | null
}

export interface WorkspaceSubscriptionState {
  workspaceId: string
  lemonSqueezySubscriptionId: string | null
  lemonSqueezyCustomerId: string | null
  variantId: string | null
  tier: SubscriptionTier
  status: SubscriptionStatus
  currentPeriodEnd: Date | null
}

export interface ResolvedSubscriptionState extends WorkspaceSubscriptionState {
  planTier: SubscriptionTier
  effectiveTier: SubscriptionTier
  limits: TierLimits
  isFree: boolean
}

export type WorkspaceSubscriptionUpsertInput = WorkspaceSubscriptionState
