import assert from "node:assert/strict"
import test from "node:test"

import {
  fetchLemonSqueezySubscription,
  mapLemonSqueezyStatus,
  parseLemonSqueezyCurrentPeriodEnd,
  resolveLemonSqueezyTier,
} from "@/server/subscriptions/lemon-squeezy"

test("resolveLemonSqueezyTier returns null for unknown variants", () => {
  assert.equal(resolveLemonSqueezyTier("999", { 123: "plus" }), null)
})

test("mapLemonSqueezyStatus normalizes Lemon Squeezy states", () => {
  assert.equal(mapLemonSqueezyStatus("on_trial"), "active")
  assert.equal(mapLemonSqueezyStatus("unpaid"), "past_due")
  assert.equal(mapLemonSqueezyStatus("cancelled"), "cancelled")
})

test("parseLemonSqueezyCurrentPeriodEnd prefers renews_at over ends_at", () => {
  assert.equal(
    parseLemonSqueezyCurrentPeriodEnd({
      renews_at: "2026-04-01T00:00:00.000Z",
      ends_at: "2026-03-01T00:00:00.000Z",
    })?.toISOString(),
    "2026-04-01T00:00:00.000Z"
  )
})

test("fetchLemonSqueezySubscription normalizes the remote subscription payload", async () => {
  process.env.LEMON_SQUEEZY_API_KEY = "test-key"

  const subscription = await fetchLemonSqueezySubscription(
    "sub_123",
    async () =>
      new Response(
        JSON.stringify({
          data: {
            id: "sub_123",
            attributes: {
              customer_id: "cus_123",
              variant_id: "variant_plus",
              status: "active",
              renews_at: "2026-05-01T00:00:00.000Z",
              ends_at: null,
            },
          },
        })
      )
  )

  assert.deepEqual(subscription, {
    lemonSqueezySubscriptionId: "sub_123",
    lemonSqueezyCustomerId: "cus_123",
    variantId: "variant_plus",
    status: "active",
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
  })
})
