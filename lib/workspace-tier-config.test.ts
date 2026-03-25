import assert from "node:assert/strict"
import test from "node:test"

import {
  getTierLimits,
  getWorkspaceTierPlan,
  getWorkspaceTierPlans,
} from "@/lib/workspace-tier-config"

test("workspace tier config exposes the enforced free-tier limits", () => {
  assert.deepEqual(getTierLimits("free"), {
    maxTrackableItems: 10,
    maxResponsesPerSurvey: 100,
    maxWorkspaceMembers: 2,
    maxApiLogsPerSecond: 1,
    logRetentionDays: 3,
  })
})

test("workspace tier plans expose highlights derived from enforced limits", () => {
  const freePlan = getWorkspaceTierPlan("free")
  const plusPlan = getWorkspaceTierPlan("plus")

  assert.deepEqual(freePlan.highlights, [
    "2 workspace members",
    "10 active trackables",
    "100 responses per survey",
    "1 API log per second",
    "3-day API log retention",
  ])

  assert.equal(plusPlan.mostPopular, true)
  assert.equal(getWorkspaceTierPlans()[0]?.tier, "free")
})
