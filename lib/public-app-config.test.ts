import assert from "node:assert/strict"
import test from "node:test"

import { getPublicAppConfig } from "@/lib/public-app-config"

test("getPublicAppConfig returns only client-safe app settings", () => {
  const publicConfig = getPublicAppConfig()

  assert.equal(typeof publicConfig.subscriptionEnforcementEnabled, "boolean")
  assert.equal(typeof publicConfig.workspaceBillingEnabled, "boolean")
  assert.ok(Array.isArray(publicConfig.workspacePlans))
  assert.equal(typeof publicConfig.defaultTierId, "string")
  assert.equal("billing" in publicConfig, false)
  assert.equal("usage" in publicConfig, false)
  assert.equal("admins" in publicConfig, false)
})
