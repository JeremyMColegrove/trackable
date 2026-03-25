import "server-only"

import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement"
import { workspaceSubscriptionRepository } from "@/server/subscriptions/subscription.repository"
import { SubscriptionService } from "@/server/subscriptions/subscription.service"

export const subscriptionService = new SubscriptionService(
  workspaceSubscriptionRepository,
  isSubscriptionEnforcementEnabled
)
