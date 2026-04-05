import type { PublicAppConfig } from "@/lib/public-app-config-types"
import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement"
import { getDefaultTierId } from "@/lib/subscription-plans"
import { getRuntimeConfig } from "@/lib/runtime-config"
import {
  getWorkspaceBillingEnabled,
  getWorkspaceTierPlans,
} from "@/lib/workspace-tier-config"

export function getPublicAppConfig(): PublicAppConfig {
  return {
    subscriptionEnforcementEnabled: isSubscriptionEnforcementEnabled(),
    workspaceBillingEnabled: getWorkspaceBillingEnabled(),
    workspacePlans: getWorkspaceTierPlans(),
    defaultTierId: getDefaultTierId(),
    customMCPServerTokens:
      getRuntimeConfig().features.customMCPServerTokens,
  }
}
