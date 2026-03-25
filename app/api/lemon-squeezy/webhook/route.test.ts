import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { processLemonSqueezyWebhook } from "@/server/subscriptions/process-lemon-squeezy-webhook"
import type { LemonSqueezySubscriptionSnapshot } from "@/server/subscriptions/lemon-squeezy"
import type { WorkspaceSubscriptionUpsertInput } from "@/server/subscriptions/types"

const webhookSecret = "secret"

function createSignature(body: string) {
  return createHmac("sha256", webhookSecret).update(body).digest("hex")
}

function createDependencies() {
  const upsertCalls: WorkspaceSubscriptionUpsertInput[] = []

  return {
    upsertCalls,
    dependencies: {
      verifyWebhook: (rawBody: string, signature: string, secret: string) =>
        createHmac("sha256", secret).update(rawBody).digest("hex") === signature,
      fetchSubscription: async (
        subscriptionId: string
      ): Promise<LemonSqueezySubscriptionSnapshot> => ({
        lemonSqueezySubscriptionId: subscriptionId,
        lemonSqueezyCustomerId: "cus_default",
        variantId: "variant_plus",
        status: "active" as const,
        currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      }),
      resolveTier: (variantId: string) =>
        variantId === "variant_plus" ? "plus" : variantId === "variant_pro" ? "pro" : null,
      upsertWorkspaceSubscription: async (
        input: WorkspaceSubscriptionUpsertInput
      ) => {
        upsertCalls.push(input)
      },
    },
  }
}

test("webhook returns 400 when the signature is invalid", async () => {
  const { dependencies } = createDependencies()
  const response = await processLemonSqueezyWebhook(
    {
      rawBody: "{}",
      signature: "not-a-valid-signature",
      webhookSecret,
      subscriptionsEnabled: true,
    },
    dependencies
  )

  assert.equal(response.status, 400)
})

test("webhook returns 404 when subscription enforcement is disabled", async () => {
  const { dependencies } = createDependencies()
  const response = await processLemonSqueezyWebhook(
    {
      rawBody: "{}",
      signature: "not-a-valid-signature",
      webhookSecret,
      subscriptionsEnabled: false,
    },
    dependencies
  )

  assert.equal(response.status, 404)
})

test("webhook returns 400 when workspace_id is missing", async () => {
  const body = JSON.stringify({
    meta: {
      event_name: "subscription_updated",
      custom_data: {},
    },
    data: {
      id: "sub_123",
    },
  })

  const { dependencies } = createDependencies()
  const response = await processLemonSqueezyWebhook(
    {
      rawBody: body,
      signature: createSignature(body),
      webhookSecret,
      subscriptionsEnabled: true,
    },
    dependencies
  )

  assert.equal(response.status, 400)
})

test("webhook fetches Lemon Squeezy state and upserts the workspace subscription", async () => {
  const { dependencies, upsertCalls } = createDependencies()
  dependencies.fetchSubscription = async () => ({
    lemonSqueezySubscriptionId: "sub_123",
    lemonSqueezyCustomerId: "cus_123",
    variantId: "variant_plus",
    status: "active",
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
  })
  const body = JSON.stringify({
    meta: {
      event_name: "subscription_updated",
      custom_data: {
        workspace_id: "workspace-123",
      },
    },
    data: {
      id: "sub_123",
    },
  })

  const response = await processLemonSqueezyWebhook(
    {
      rawBody: body,
      signature: createSignature(body),
      webhookSecret,
      subscriptionsEnabled: true,
    },
    dependencies
  )

  assert.equal(response.status, 200)
  assert.equal(upsertCalls.length, 1)
  assert.deepEqual(upsertCalls[0], {
    workspaceId: "workspace-123",
    lemonSqueezySubscriptionId: "sub_123",
    lemonSqueezyCustomerId: "cus_123",
    variantId: "variant_plus",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
  })
})

test("webhook fails safely for unknown Lemon Squeezy variants", async () => {
  const { dependencies } = createDependencies()
  dependencies.fetchSubscription = async () => ({
    lemonSqueezySubscriptionId: "sub_999",
    lemonSqueezyCustomerId: "cus_999",
    variantId: "variant_unknown",
    status: "active",
    currentPeriodEnd: null,
  })
  const body = JSON.stringify({
    meta: {
      event_name: "subscription_updated",
      custom_data: {
        workspace_id: "workspace-999",
      },
    },
    data: {
      id: "sub_999",
    },
  })

  const response = await processLemonSqueezyWebhook(
    {
      rawBody: body,
      signature: createSignature(body),
      webhookSecret,
      subscriptionsEnabled: true,
    },
    dependencies
  )

  assert.equal(response.status, 500)
})

test("webhook persists inactive subscription statuses from Lemon Squeezy", async () => {
  const { dependencies, upsertCalls } = createDependencies()
  dependencies.fetchSubscription = async () => ({
    lemonSqueezySubscriptionId: "sub_456",
    lemonSqueezyCustomerId: "cus_456",
    variantId: "variant_pro",
    status: "paused",
    currentPeriodEnd: new Date("2026-05-10T00:00:00.000Z"),
  })
  const body = JSON.stringify({
    meta: {
      event_name: "subscription_paused",
      custom_data: {
        workspace_id: "workspace-456",
      },
    },
    data: {
      id: "sub_456",
    },
  })

  const response = await processLemonSqueezyWebhook(
    {
      rawBody: body,
      signature: createSignature(body),
      webhookSecret,
      subscriptionsEnabled: true,
    },
    dependencies
  )

  assert.equal(response.status, 200)
  assert.equal(upsertCalls[0]?.status, "paused")
})
