import type { PublicAppConfig } from "@/lib/public-app-config-types"
import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement"
import {
  getWorkspaceBillingEnabled,
  getWorkspaceTierPlans,
} from "@/lib/workspace-tier-config"

export function getPublicAppConfig(): PublicAppConfig {
  return {
    subscriptionEnforcementEnabled: isSubscriptionEnforcementEnabled(),
    workspaceBillingEnabled: getWorkspaceBillingEnabled(),
    workspaceTierPlans: getWorkspaceTierPlans(),
  }
}
