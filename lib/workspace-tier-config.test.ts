import assert from "node:assert/strict"
import test from "node:test"

import {
  getTierLimits,
  getWorkspaceTierPlan,
  getWorkspaceTierPlans,
  resolveWorkspaceTierFromLemonSqueezyVariantId,
} from "@/lib/workspace-tier-config"

test("workspace tier config exposes the enforced free-tier limits", () => {
  assert.deepEqual(getTierLimits("free"), {
    maxTrackableItems: 10,
    maxResponsesPerSurvey: 100,
    maxWorkspaceMembers: 2,
    maxApiLogsPerMinute: 30,
    logRetentionDays: 3,
  })
})

test("workspace tier plans expose highlights derived from enforced limits", () => {
  const freePlan = getWorkspaceTierPlan("free")
  const plusPlan = getWorkspaceTierPlan("plus")
  const proPlan = getWorkspaceTierPlan("pro")

  assert.deepEqual(freePlan.highlights, [
    "2 workspace members",
    "10 active trackables",
    "100 responses per survey",
    "30 API logs per minute",
    "3-day API log retention",
  ])

  assert.equal(plusPlan.mostPopular, true)
  assert.equal(plusPlan.lemonSqueezyVariantId, "12345")
  assert.equal(proPlan.lemonSqueezyVariantId, "67890")
  assert.equal(getWorkspaceTierPlans()[0]?.tier, "free")
})

test("workspace tier config resolves Lemon Squeezy variant ids without env config", () => {
  assert.equal(resolveWorkspaceTierFromLemonSqueezyVariantId("12345"), "plus")
  assert.equal(resolveWorkspaceTierFromLemonSqueezyVariantId("67890"), "pro")
  assert.equal(resolveWorkspaceTierFromLemonSqueezyVariantId("99999"), null)
})
