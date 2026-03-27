import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { LemonSqueezySyncService } from "@/server/subscriptions/lemon-squeezy-sync.service"
import { LemonSqueezyWebhookHandler } from "@/server/subscriptions/lemon-squeezy-webhook-handler"
import type { WorkspaceSubscriptionState } from "@/server/subscriptions/types"

const webhookSecret = "secret"

class InMemoryWorkspaceSubscriptionRepository {
  private readonly subscriptions = new Map<string, WorkspaceSubscriptionState>()

  async findByWorkspaceId(workspaceId: string) {
    return this.subscriptions.get(workspaceId) ?? null
  }

  async upsert(input: WorkspaceSubscriptionState) {
    this.subscriptions.set(input.workspaceId, { ...input })
  }
}

function createSignature(body: string) {
  return createHmac("sha256", webhookSecret).update(body).digest("hex")
}

function createWebhookPayload(input: {
  eventName: string
  subscriptionId?: string
  workspaceId?: string
}) {
  return JSON.stringify({
    meta: {
      event_name: input.eventName,
      custom_data:
        typeof input.workspaceId === "string"
          ? {
              workspace_id: input.workspaceId,
            }
          : {},
    },
    data: input.subscriptionId
      ? {
          id: input.subscriptionId,
          type: "subscriptions",
        }
      : {},
  })
}

function createSubscriptionApiResponse(input: {
  subscriptionId: string
  customerId?: string | null
  variantId: string
  status: string
  renewsAt?: string | null
  endsAt?: string | null
}) {
  return {
    data: {
      id: input.subscriptionId,
      type: "subscriptions",
      attributes: {
        customer_id: input.customerId ?? null,
        variant_id: input.variantId,
        status: input.status,
        renews_at: input.renewsAt ?? null,
        ends_at: input.endsAt ?? null,
      },
    },
  }
}

function createHandler(options?: {
  subscriptionsEnabled?: boolean
  payloadFactory?: () => ReturnType<typeof createSubscriptionApiResponse>
}) {
  const repository = new InMemoryWorkspaceSubscriptionRepository()
  const syncService = new LemonSqueezySyncService(
    repository,
    async () =>
      new Response(
        JSON.stringify(
          options?.payloadFactory?.() ??
            createSubscriptionApiResponse({
              subscriptionId: "sub_123",
              customerId: "cus_123",
              variantId: "12345",
              status: "active",
              renewsAt: "2026-05-01T00:00:00.000Z",
            })
        )
      ),
    "test-key"
  )

  const handler = new LemonSqueezyWebhookHandler({
    subscriptionsEnabled: () => options?.subscriptionsEnabled ?? true,
    webhookSecret: () => webhookSecret,
    verifyWebhook: (rawBody, signature, secret) =>
      createHmac("sha256", secret).update(rawBody).digest("hex") === signature,
    syncService,
  })

  return {
    repository,
    handler,
  }
}

test("webhook returns 400 when the signature is invalid", async () => {
  const { handler } = createHandler()

  const response = await handler.handle({
    rawBody: "{}",
    signature: "not-a-valid-signature",
  })

  assert.equal(response.status, 400)
})

test("webhook returns 404 when subscription enforcement is disabled", async () => {
  const { handler } = createHandler({ subscriptionsEnabled: false })

  const response = await handler.handle({
    rawBody: "{}",
    signature: "not-a-valid-signature",
  })

  assert.equal(response.status, 404)
})

test("webhook returns 400 when workspace_id is missing", async () => {
  const body = createWebhookPayload({
    eventName: "subscription_updated",
    subscriptionId: "sub_123",
  })
  const { handler } = createHandler()

  const response = await handler.handle({
    rawBody: body,
    signature: createSignature(body),
  })

  assert.equal(response.status, 400)
})

test("webhook returns 400 when the subscription id is missing", async () => {
  const body = createWebhookPayload({
    eventName: "subscription_updated",
    workspaceId: "workspace-123",
  })
  const { handler } = createHandler()

  const response = await handler.handle({
    rawBody: body,
    signature: createSignature(body),
  })

  assert.equal(response.status, 400)
})

test("webhook syncs fresh Lemon Squeezy data even when the webhook payload is partial", async () => {
  const body = createWebhookPayload({
    eventName: "subscription_updated",
    subscriptionId: "sub_partial",
    workspaceId: "workspace-partial",
  })
  const { handler, repository } = createHandler({
    payloadFactory: () =>
      createSubscriptionApiResponse({
        subscriptionId: "sub_partial",
        customerId: "cus_partial",
        variantId: "12345",
        status: "active",
        renewsAt: "2026-05-01T00:00:00.000Z",
      }),
  })

  const response = await handler.handle({
    rawBody: body,
    signature: createSignature(body),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await repository.findByWorkspaceId("workspace-partial"), {
    workspaceId: "workspace-partial",
    lemonSqueezySubscriptionId: "sub_partial",
    lemonSqueezyCustomerId: "cus_partial",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
  })
})

test("webhook updates existing local state and remains idempotent across repeated events", async () => {
  const body = createWebhookPayload({
    eventName: "subscription_updated",
    subscriptionId: "sub_repeat",
    workspaceId: "workspace-repeat",
  })
  const { handler, repository } = createHandler({
    payloadFactory: () =>
      createSubscriptionApiResponse({
        subscriptionId: "sub_repeat",
        customerId: "cus_repeat",
        variantId: "67890",
        status: "cancelled",
        endsAt: "2026-06-01T00:00:00.000Z",
      }),
  })

  await repository.upsert({
    workspaceId: "workspace-repeat",
    lemonSqueezySubscriptionId: "sub_repeat",
    lemonSqueezyCustomerId: "cus_old",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
  })

  const first = await handler.handle({
    rawBody: body,
    signature: createSignature(body),
  })
  const second = await handler.handle({
    rawBody: body,
    signature: createSignature(body),
  })

  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.deepEqual(await repository.findByWorkspaceId("workspace-repeat"), {
    workspaceId: "workspace-repeat",
    lemonSqueezySubscriptionId: "sub_repeat",
    lemonSqueezyCustomerId: "cus_repeat",
    variantId: "67890",
    tier: "pro",
    status: "cancelled",
    currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
  })
})

test("webhook fails safely for unknown variants and leaves local state unchanged", async () => {
  const body = createWebhookPayload({
    eventName: "subscription_updated",
    subscriptionId: "sub_unknown",
    workspaceId: "workspace-unknown",
  })
  const { handler, repository } = createHandler({
    payloadFactory: () =>
      createSubscriptionApiResponse({
        subscriptionId: "sub_unknown",
        customerId: "cus_unknown",
        variantId: "variant_unknown",
        status: "active",
        renewsAt: "2026-07-01T00:00:00.000Z",
      }),
  })

  await repository.upsert({
    workspaceId: "workspace-unknown",
    lemonSqueezySubscriptionId: "sub_unknown",
    lemonSqueezyCustomerId: "cus_existing",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
  })

  const response = await handler.handle({
    rawBody: body,
    signature: createSignature(body),
  })

  assert.equal(response.status, 500)
  assert.deepEqual(await repository.findByWorkspaceId("workspace-unknown"), {
    workspaceId: "workspace-unknown",
    lemonSqueezySubscriptionId: "sub_unknown",
    lemonSqueezyCustomerId: "cus_existing",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
  })
})
