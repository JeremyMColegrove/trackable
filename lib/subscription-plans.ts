import type { BillingTierConfig, LimitsEntry, RuntimeConfig } from "@/lib/runtime-config"
import { getRuntimeConfig } from "@/lib/runtime-config"
import type { TierLimits } from "@/server/subscriptions/types"

const UNLIMITED_LIMITS: TierLimits = {
  maxTrackableItems: null,
  maxResponsesPerSurvey: null,
  maxWorkspaceMembers: null,
  maxApiLogsPerMinute: null,
  maxApiPayloadBytes: null,
  logRetentionDays: null,
  maxCreatedWorkspaces: null,
}

const SYNTHETIC_DEFAULT_LIMITS_ENTRY: LimitsEntry = {
  id: "default",
  billingTier: null,
  ...UNLIMITED_LIMITS,
}

// Internal Map cache — rebuilt whenever the runtime config reference changes.
let _limitsMapConfig: RuntimeConfig | null = null
let _limitsMap: Map<string, LimitsEntry> = new Map()

function getLimitsMap(): Map<string, LimitsEntry> {
  const config = getRuntimeConfig()
  if (config !== _limitsMapConfig) {
    const entries = config.limits ?? [SYNTHETIC_DEFAULT_LIMITS_ENTRY]
    _limitsMap = new Map(entries.map((e) => [e.id, e]))
    _limitsMapConfig = config
  }
  return _limitsMap
}

/** Returns limits entries from config. If none configured, returns a single unlimited entry. */
export function getLimitsEntries(): LimitsEntry[] {
  return getRuntimeConfig().limits ?? [SYNTHETIC_DEFAULT_LIMITS_ENTRY]
}

/** Returns the default limits entry — the one with billingTier: null (the unsubscribed/free tier).
 *  Falls back to the entry whose billing tier has no LemonSqueezy variant, or the first entry. */
export function getDefaultLimitsEntry(): LimitsEntry {
  const entries = getLimitsEntries()

  // Prefer an entry explicitly marked as having no billing tier.
  const explicitDefault = entries.find((e) => e.billingTier === null)
  if (explicitDefault) return explicitDefault

  // Fall back to the entry whose billing tier has no LemonSqueezy variant (free).
  const config = getRuntimeConfig()
  const freeBillingTierIds = new Set(
    config.billing.tiers
      .filter((t) => t.lemonSqueezyVariantId === null)
      .map((t) => t.id)
  )
  const freeTierEntry = entries.find(
    (e) => e.billingTier !== null && freeBillingTierIds.has(e.billingTier)
  )
  if (freeTierEntry) return freeTierEntry

  return entries[0]
}

/** Returns the tier ID for the default (unsubscribed/free) tier. */
export function getDefaultTierId(): string {
  return getDefaultLimitsEntry().id
}

/** Returns limits for a given tier ID. Falls back to unlimited limits if not found. */
export function getLimitsForTier(tierId: string): TierLimits {
  const entry = getLimitsMap().get(tierId)
  if (!entry) return UNLIMITED_LIMITS
  const { id: _id, billingTier: _billingTier, ...limits } = entry
  return limits
}

/**
 * Resolves a tier ID from a LemonSqueezy variant ID.
 * Looks up the billing tier by variantId, then finds the limits entry that
 * references that billing tier.
 */
export function resolveTierFromVariantId(variantId: string): string | null {
  const billingTier = getRuntimeConfig().billing.tiers.find(
    (t) => t.lemonSqueezyVariantId === variantId
  )
  if (!billingTier) return null

  const entries = getLimitsEntries()
  const limitsEntry = entries.find((e) => e.billingTier === billingTier.id)
  return limitsEntry?.id ?? null
}

/** Returns the max workspaces a user can create, from the default limits entry. */
export function getFreeTierCreatedWorkspaceLimit(): number | null {
  return getDefaultLimitsEntry().maxCreatedWorkspaces
}

/** Returns all billing tiers from config. */
export function getBillingTiers(): BillingTierConfig[] {
  return getRuntimeConfig().billing.tiers
}

/** Returns a billing tier by its ID, or undefined. */
export function getBillingTierById(id: string): BillingTierConfig | undefined {
  return getRuntimeConfig().billing.tiers.find((t) => t.id === id)
}
