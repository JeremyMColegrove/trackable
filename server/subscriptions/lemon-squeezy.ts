import { resolveWorkspaceTierFromLemonSqueezyVariantId } from "@/lib/workspace-tier-config"
import { logger } from "@/lib/logger"
import type {
  SubscriptionStatus,
  SubscriptionTier,
} from "@/server/subscriptions/types"

export type LemonSqueezySubscriptionStatus =
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired"

interface LemonSqueezySubscriptionResponse {
  data?: {
    id?: string | number
    attributes?: {
      customer_id?: string | number | null
      variant_id?: string | number | null
      status?: LemonSqueezySubscriptionStatus
      renews_at?: string | null
      ends_at?: string | null
    }
  }
}

export interface LemonSqueezySubscriptionSnapshot {
  lemonSqueezySubscriptionId: string
  lemonSqueezyCustomerId: string | null
  variantId: string
  status: SubscriptionStatus
  currentPeriodEnd: Date | null
}

export function resolveLemonSqueezyTier(
  variantId: string
): SubscriptionTier | null {
  const tier = resolveWorkspaceTierFromLemonSqueezyVariantId(variantId)

  if (tier === null) {
    logger.warn({ variantId }, "Unknown Lemon Squeezy variant id")
  }

  return tier
}

export function mapLemonSqueezyStatus(
  status: LemonSqueezySubscriptionStatus
): SubscriptionStatus {
  switch (status) {
    case "on_trial":
    case "active":
      return "active"
    case "paused":
      return "paused"
    case "past_due":
    case "unpaid":
      return "past_due"
    case "cancelled":
      return "cancelled"
    case "expired":
      return "expired"
  }
}

export function parseLemonSqueezyCurrentPeriodEnd(input: {
  renews_at?: string | null
  ends_at?: string | null
}): Date | null {
  const value = input.renews_at ?? input.ends_at
  return value ? new Date(value) : null
}

export async function fetchLemonSqueezySubscription(
  subscriptionId: string,
  fetchImpl: typeof fetch = fetch
): Promise<LemonSqueezySubscriptionSnapshot> {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY

  if (!apiKey) {
    throw new Error("LEMON_SQUEEZY_API_KEY is not configured.")
  }

  const response = await fetchImpl(
    `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/vnd.api+json",
      },
      cache: "no-store",
    }
  )

  if (!response.ok) {
    throw new Error(
      `Lemon Squeezy API request failed with status ${response.status}.`
    )
  }

  const payload = (await response.json()) as LemonSqueezySubscriptionResponse
  const data = payload.data
  const attributes = data?.attributes
  const variantId = attributes?.variant_id
  const status = attributes?.status

  if (!data?.id || !variantId || !status) {
    throw new Error("Lemon Squeezy subscription response is missing fields.")
  }

  return {
    lemonSqueezySubscriptionId: String(data.id),
    lemonSqueezyCustomerId: attributes.customer_id
      ? String(attributes.customer_id)
      : null,
    variantId: String(variantId),
    status: mapLemonSqueezyStatus(status),
    currentPeriodEnd: parseLemonSqueezyCurrentPeriodEnd(attributes),
  }
}
