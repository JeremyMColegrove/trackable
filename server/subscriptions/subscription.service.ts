import { getLimitsForTier } from "@/lib/subscription-plans"
import type { WorkspaceSubscriptionRepository } from "@/server/subscriptions/subscription.repository"
import type {
  ResolvedSubscriptionState,
  SubscriptionTier,
  TierLimits,
  WorkspaceSubscriptionState,
  WorkspaceSubscriptionUpsertInput,
} from "@/server/subscriptions/types"

export class SubscriptionService {
  constructor(
    private readonly repository: WorkspaceSubscriptionRepository,
    private readonly subscriptionEnforcementEnabled: () => boolean
  ) {}

  async ensureWorkspaceSubscription(
    workspaceId: string
  ): Promise<WorkspaceSubscriptionState> {
    if (!this.subscriptionEnforcementEnabled()) {
      return this.buildSubscriptionsDisabledState(workspaceId)
    }

    const existing = await this.repository.findByWorkspaceId(workspaceId)

    if (existing) {
      return existing
    }

    const freeSubscription = this.buildFreeSubscriptionState(workspaceId)

    await this.repository.upsert(freeSubscription)

    return freeSubscription
  }

  async getState(workspaceId: string): Promise<ResolvedSubscriptionState> {
    if (!this.subscriptionEnforcementEnabled()) {
      return this.buildResolvedState(
        this.buildSubscriptionsDisabledState(workspaceId)
      )
    }

    const subscription = await this.ensureWorkspaceSubscription(workspaceId)

    return this.buildResolvedState(subscription)
  }

  async getWorkspaceTier(workspaceId: string): Promise<SubscriptionTier> {
    if (!this.subscriptionEnforcementEnabled()) {
      return "pro"
    }

    const state = await this.getState(workspaceId)
    return state.effectiveTier
  }

  async getWorkspaceLimits(workspaceId: string): Promise<TierLimits> {
    if (!this.subscriptionEnforcementEnabled()) {
      return getLimitsForTier("pro")
    }

    const state = await this.getState(workspaceId)
    return state.limits
  }

  private buildSubscriptionsDisabledState(
    workspaceId: string
  ): WorkspaceSubscriptionState {
    return {
      workspaceId,
      lemonSqueezySubscriptionId: null,
      lemonSqueezyCustomerId: null,
      variantId: null,
      tier: "pro",
      status: "active",
      currentPeriodEnd: null,
    }
  }

  private buildFreeSubscriptionState(
    workspaceId: string
  ): WorkspaceSubscriptionUpsertInput {
    return {
      workspaceId,
      lemonSqueezySubscriptionId: null,
      lemonSqueezyCustomerId: null,
      variantId: null,
      tier: "free",
      status: "active",
      currentPeriodEnd: null,
    }
  }

  private buildResolvedState(
    subscription: WorkspaceSubscriptionState
  ): ResolvedSubscriptionState {
    const effectiveTier =
      subscription.status === "active" ? subscription.tier : "free"

    return {
      ...subscription,
      planTier: subscription.tier,
      effectiveTier,
      limits: getLimitsForTier(effectiveTier),
      isFree: effectiveTier === "free",
    }
  }
}
