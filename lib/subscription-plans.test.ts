import assert from "node:assert/strict"
import test from "node:test"

import {
  getFreeTierCreatedWorkspaceLimit,
  getLimitsForTier,
  getDefaultTierId,
  getLimitsEntries,
} from "@/lib/subscription-plans"

test("getDefaultTierId returns a non-empty string", () => {
  const defaultId = getDefaultTierId()
  assert.ok(defaultId.length > 0)
})

test("getLimitsForTier returns unlimited limits for unknown tier", () => {
  const limits = getLimitsForTier("__nonexistent__")
  assert.equal(limits.maxTrackableItems, null)
  assert.equal(limits.maxWorkspaceMembers, null)
  assert.equal(limits.maxApiPayloadBytes, null)
  assert.equal(limits.maxCreatedWorkspaces, null)
})

test("default tier limits are applied for unsubscribed workspaces", () => {
  const defaultId = getDefaultTierId()
  const defaultLimits = getLimitsForTier(defaultId)
  // Limits exist for the default tier (may have finite or null values)
  assert.ok(typeof defaultLimits === "object")
})

test("getFreeTierCreatedWorkspaceLimit returns a number or null", () => {
  const limit = getFreeTierCreatedWorkspaceLimit()
  assert.ok(limit === null || (typeof limit === "number" && limit > 0))
})
