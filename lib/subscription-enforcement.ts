export function isSubscriptionEnforcementEnabled(): boolean {
  return getRuntimeConfig().features.subscriptionEnforcementEnabled
}

import { getRuntimeConfig } from "@/lib/runtime-config"
