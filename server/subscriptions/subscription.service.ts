import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { workspaceSubscriptions } from "@/db/schema"
import { getTierLimits } from "@/server/subscriptions/tier-limits"
import { areTiersUnlocked } from "@/server/subscriptions/tiers-unlocked"
import type { SubscriptionTier, TierLimits } from "@/server/subscriptions/types"

interface UpsertWebhookInput {
  workspaceId: string
  lemonSqueezySubscriptionId: string
  lemonSqueezyCustomerId: string
  variantId: string
  tier: SubscriptionTier
  status: "active" | "cancelled" | "expired" | "paused" | "past_due"
  currentPeriodEnd: Date | null
}

export class SubscriptionService {
  async upsertFromWebhook(input: UpsertWebhookInput) {
    if (areTiersUnlocked()) {
      return
    }

    await db
      .insert(workspaceSubscriptions)
      .values({
        workspaceId: input.workspaceId,
        lemonSqueezySubscriptionId: input.lemonSqueezySubscriptionId,
        lemonSqueezyCustomerId: input.lemonSqueezyCustomerId,
        variantId: input.variantId,
        tier: input.tier,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd,
      })
      .onConflictDoUpdate({
        target: workspaceSubscriptions.lemonSqueezySubscriptionId,
        set: {
          variantId: input.variantId,
          tier: input.tier,
          status: input.status,
          currentPeriodEnd: input.currentPeriodEnd,
          lemonSqueezyCustomerId: input.lemonSqueezyCustomerId,
          updatedAt: new Date(),
        },
      })
  }

  async getWorkspaceTier(workspaceId: string): Promise<SubscriptionTier> {
    if (areTiersUnlocked()) {
      return "pro"
    }

    const subscription = await db.query.workspaceSubscriptions.findFirst({
      where: eq(workspaceSubscriptions.workspaceId, workspaceId),
      columns: {
        tier: true,
        status: true,
      },
    })

    if (!subscription || subscription.status !== "active") {
      return "free"
    }

    return subscription.tier
  }

  async getWorkspaceLimits(workspaceId: string): Promise<TierLimits> {
    if (areTiersUnlocked()) {
      return getTierLimits("pro")
    }

    const tier = await this.getWorkspaceTier(workspaceId)
    return getTierLimits(tier)
  }
}

export const subscriptionService = new SubscriptionService()
