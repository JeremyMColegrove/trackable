import assert from "node:assert/strict"
import test from "node:test"

import {
  getTierLimits,
  getWorkspaceTierPlan,
  getWorkspaceTierPlans,
  resolveWorkspaceTierFromLemonSqueezyVariantId,
} from "@/lib/workspace-tier-config"

test("workspace tier config exposes each plan's enforced limits", () => {
  for (const plan of getWorkspaceTierPlans()) {
    assert.equal(getTierLimits(plan.tier), plan.limits)
  }
})

test("workspace tier plans expose highlights derived from enforced limits", () => {
  const freePlan = getWorkspaceTierPlan("free")
  const plusPlan = getWorkspaceTierPlan("plus")
  const proPlan = getWorkspaceTierPlan("pro")

  assert.deepEqual(freePlan.highlights, buildExpectedHighlights(freePlan.limits))
  assert.deepEqual(plusPlan.highlights, buildExpectedHighlights(plusPlan.limits))
  assert.deepEqual(proPlan.highlights, buildExpectedHighlights(proPlan.limits))

  assert.equal(plusPlan.mostPopular, true)
  assert.equal(getWorkspaceTierPlans()[0]?.tier, "free")
})

test("workspace tier config resolves every configured Lemon Squeezy variant id", () => {
  for (const plan of getWorkspaceTierPlans()) {
    if (!plan.lemonSqueezyVariantId) {
      continue
    }

    assert.equal(
      resolveWorkspaceTierFromLemonSqueezyVariantId(plan.lemonSqueezyVariantId),
      plan.tier
    )
  }

  assert.equal(resolveWorkspaceTierFromLemonSqueezyVariantId("unknown"), null)
})

function buildExpectedHighlights(limits: ReturnType<typeof getTierLimits>) {
  return [
    formatUsageLimit(
      limits.maxWorkspaceMembers,
      "workspace member",
      "workspace members"
    ),
    formatUsageLimit(
      limits.maxTrackableItems,
      "active trackable",
      "active trackables"
    ),
    formatUsageLimit(
      limits.maxResponsesPerSurvey,
      "response per survey",
      "responses per survey"
    ),
    formatUsageLimit(
      limits.maxApiLogsPerMinute,
      "API log per minute",
      "API logs per minute"
    ),
    limits.logRetentionDays === null
      ? "Unlimited API log retention"
      : `${limits.logRetentionDays}-day API log retention`,
  ]
}

function formatUsageLimit(
  value: number | null,
  singularLabel: string,
  pluralLabel: string
) {
  return value === null
    ? `Unlimited ${pluralLabel}`
    : `${value} ${value === 1 ? singularLabel : pluralLabel}`
}
