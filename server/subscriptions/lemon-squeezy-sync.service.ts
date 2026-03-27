import { resolveTierFromVariantId } from "@/lib/subscription-plans"
import { logger } from "@/lib/logger"
import type { WorkspaceSubscriptionRepository } from "@/server/subscriptions/subscription.repository"
import type {
  SubscriptionStatus,
  SubscriptionTier,
  WorkspaceSubscriptionState,
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

interface LemonSqueezyRemoteSubscription {
  lemonSqueezySubscriptionId: string
  lemonSqueezyCustomerId: string | null
  variantId: string
  status: SubscriptionStatus
  currentPeriodEnd: Date | null
}

export interface LemonSqueezySyncInput {
  workspaceId: string
  subscriptionId: string
}

export class LemonSqueezySyncService {
  constructor(
    private readonly repository: WorkspaceSubscriptionRepository,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly apiKey: string | undefined = process.env
      .LEMON_SQUEEZY_API_KEY
  ) {}

  async sync(
    input: LemonSqueezySyncInput
  ): Promise<WorkspaceSubscriptionState> {
    const remoteSubscription = await this.fetchSubscription(
      input.subscriptionId
    )
    const tier = this.resolveTier(remoteSubscription.variantId)
    const subscription = this.buildSubscriptionState({
      workspaceId: input.workspaceId,
      tier,
      remoteSubscription,
    })

    await this.repository.upsert(subscription)

    return subscription
  }

  private async fetchSubscription(
    subscriptionId: string
  ): Promise<LemonSqueezyRemoteSubscription> {
    if (!this.apiKey) {
      throw new Error("LEMON_SQUEEZY_API_KEY is not configured.")
    }

    const response = await this.fetchImpl(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${this.apiKey}`,
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
      status: this.mapStatus(status),
      currentPeriodEnd: this.parseCurrentPeriodEnd(attributes),
    }
  }

  private resolveTier(variantId: string): SubscriptionTier {
    const tier = resolveTierFromVariantId(variantId)

    if (!tier) {
      logger.warn({ variantId }, "Unknown Lemon Squeezy variant id")
      throw new Error("Unknown Lemon Squeezy variant id.")
    }

    return tier
  }

  private mapStatus(
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

  private parseCurrentPeriodEnd(input: {
    renews_at?: string | null
    ends_at?: string | null
  }): Date | null {
    const value = input.renews_at ?? input.ends_at
    return value ? new Date(value) : null
  }

  private buildSubscriptionState(input: {
    workspaceId: string
    tier: SubscriptionTier
    remoteSubscription: LemonSqueezyRemoteSubscription
  }): WorkspaceSubscriptionState {
    return {
      workspaceId: input.workspaceId,
      lemonSqueezySubscriptionId:
        input.remoteSubscription.lemonSqueezySubscriptionId,
      lemonSqueezyCustomerId: input.remoteSubscription.lemonSqueezyCustomerId,
      variantId: input.remoteSubscription.variantId,
      tier: input.tier,
      status: input.remoteSubscription.status,
      currentPeriodEnd: input.remoteSubscription.currentPeriodEnd,
    }
  }
}
