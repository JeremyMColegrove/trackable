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
    assert.deepEqual(getTierLimits(plan.tierId), plan.limits)
  }
})

test("workspace tier plans expose highlights derived from enforced limits", () => {
  const freePlan = getWorkspaceTierPlan("free")
  const plusPlan = getWorkspaceTierPlan("plus")
  const proPlan = getWorkspaceTierPlan("pro")

  if (freePlan) {
    assert.deepEqual(
      freePlan.highlights,
      buildExpectedHighlights(freePlan.limits)
    )
  }
  if (plusPlan) {
    assert.deepEqual(
      plusPlan.highlights,
      buildExpectedHighlights(plusPlan.limits)
    )
    assert.equal(plusPlan.mostPopular, true)
  }
  if (proPlan) {
    assert.deepEqual(proPlan.highlights, buildExpectedHighlights(proPlan.limits))
  }

  const plans = getWorkspaceTierPlans()
  assert.equal(plans[0]?.tierId, "free")
})

test("workspace tier config resolves every configured Lemon Squeezy variant id", () => {
  for (const plan of getWorkspaceTierPlans()) {
    if (!plan.lemonSqueezyVariantId) {
      continue
    }

    assert.equal(
      resolveWorkspaceTierFromLemonSqueezyVariantId(plan.lemonSqueezyVariantId),
      plan.tierId
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
    formatByteLimit(limits.maxApiPayloadBytes),
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

function formatByteLimit(value: number | null) {
  if (value === null) {
    return "Unlimited API payload size"
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB API payload size`
  }

  return `${value} byte API payload size`
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
