import assert from "node:assert/strict"
import test from "node:test"

import { LemonSqueezySyncService } from "@/server/subscriptions/lemon-squeezy-sync.service"
import type {
  WorkspaceSubscriptionState,
  WorkspaceSubscriptionUpsertInput,
} from "@/server/subscriptions/types"

class InMemoryWorkspaceSubscriptionRepository {
  private readonly subscriptions = new Map<string, WorkspaceSubscriptionState>()

  async findByWorkspaceId(workspaceId: string) {
    return this.subscriptions.get(workspaceId) ?? null
  }

  async upsert(input: WorkspaceSubscriptionUpsertInput) {
    this.subscriptions.set(input.workspaceId, { ...input })
  }
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

function createSyncHarness(
  payloadFactory: () => ReturnType<typeof createSubscriptionApiResponse>
) {
  const repository = new InMemoryWorkspaceSubscriptionRepository()
  const requests: string[] = []
  const service = new LemonSqueezySyncService(
    repository,
    async (input) => {
      requests.push(String(input))
      return new Response(JSON.stringify(payloadFactory()))
    },
    "test-key"
  )

  return {
    repository,
    requests,
    service,
  }
}

test("sync creates the initial local subscription from fresh Lemon Squeezy data", async () => {
  const { repository, requests, service } = createSyncHarness(() =>
    createSubscriptionApiResponse({
      subscriptionId: "sub_123",
      customerId: "cus_123",
      variantId: "12345",
      status: "active",
      renewsAt: "2026-05-01T00:00:00.000Z",
    })
  )

  const subscription = await service.sync({
    workspaceId: "workspace-123",
    subscriptionId: "sub_123",
  })

  assert.equal(
    requests[0],
    "https://api.lemonsqueezy.com/v1/subscriptions/sub_123"
  )
  assert.deepEqual(subscription, {
    workspaceId: "workspace-123",
    lemonSqueezySubscriptionId: "sub_123",
    lemonSqueezyCustomerId: "cus_123",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
  })
  assert.deepEqual(
    await repository.findByWorkspaceId("workspace-123"),
    subscription
  )
})

test("sync updates stale local data with fresh upstream state", async () => {
  const { repository, service } = createSyncHarness(() =>
    createSubscriptionApiResponse({
      subscriptionId: "sub_456",
      customerId: "cus_456",
      variantId: "67890",
      status: "active",
      renewsAt: "2026-06-01T00:00:00.000Z",
    })
  )

  await repository.upsert({
    workspaceId: "workspace-456",
    lemonSqueezySubscriptionId: "sub_456",
    lemonSqueezyCustomerId: "cus_old",
    variantId: "12345",
    tier: "plus",
    status: "past_due",
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
  })

  const subscription = await service.sync({
    workspaceId: "workspace-456",
    subscriptionId: "sub_456",
  })

  assert.deepEqual(subscription, {
    workspaceId: "workspace-456",
    lemonSqueezySubscriptionId: "sub_456",
    lemonSqueezyCustomerId: "cus_456",
    variantId: "67890",
    tier: "pro",
    status: "active",
    currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
  })
})

test("sync persists cancelled subscriptions", async () => {
  const { repository, service } = createSyncHarness(() =>
    createSubscriptionApiResponse({
      subscriptionId: "sub_cancelled",
      customerId: "cus_cancelled",
      variantId: "12345",
      status: "cancelled",
      endsAt: "2026-05-15T00:00:00.000Z",
    })
  )

  await service.sync({
    workspaceId: "workspace-cancelled",
    subscriptionId: "sub_cancelled",
  })

  assert.deepEqual(await repository.findByWorkspaceId("workspace-cancelled"), {
    workspaceId: "workspace-cancelled",
    lemonSqueezySubscriptionId: "sub_cancelled",
    lemonSqueezyCustomerId: "cus_cancelled",
    variantId: "12345",
    tier: "plus",
    status: "cancelled",
    currentPeriodEnd: new Date("2026-05-15T00:00:00.000Z"),
  })
})

test("sync persists expired subscriptions as inactive local state", async () => {
  const { repository, service } = createSyncHarness(() =>
    createSubscriptionApiResponse({
      subscriptionId: "sub_expired",
      customerId: "cus_expired",
      variantId: "67890",
      status: "expired",
      endsAt: "2026-05-20T00:00:00.000Z",
    })
  )

  await service.sync({
    workspaceId: "workspace-expired",
    subscriptionId: "sub_expired",
  })

  assert.equal(
    (await repository.findByWorkspaceId("workspace-expired"))?.status,
    "expired"
  )
})

test("sync updates the stored tier when the Lemon Squeezy plan changes", async () => {
  const { repository, service } = createSyncHarness(() =>
    createSubscriptionApiResponse({
      subscriptionId: "sub_plan_change",
      customerId: "cus_plan_change",
      variantId: "67890",
      status: "active",
      renewsAt: "2026-07-01T00:00:00.000Z",
    })
  )

  await repository.upsert({
    workspaceId: "workspace-plan-change",
    lemonSqueezySubscriptionId: "sub_plan_change",
    lemonSqueezyCustomerId: "cus_plan_change",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
  })

  const subscription = await service.sync({
    workspaceId: "workspace-plan-change",
    subscriptionId: "sub_plan_change",
  })

  assert.equal(subscription.tier, "pro")
  assert.equal(subscription.variantId, "67890")
})

test("sync is idempotent for repeated webhook-driven refreshes", async () => {
  const { repository, service } = createSyncHarness(() =>
    createSubscriptionApiResponse({
      subscriptionId: "sub_repeat",
      customerId: "cus_repeat",
      variantId: "12345",
      status: "active",
      renewsAt: "2026-08-01T00:00:00.000Z",
    })
  )

  const first = await service.sync({
    workspaceId: "workspace-repeat",
    subscriptionId: "sub_repeat",
  })
  const second = await service.sync({
    workspaceId: "workspace-repeat",
    subscriptionId: "sub_repeat",
  })

  assert.deepEqual(first, second)
  assert.deepEqual(
    await repository.findByWorkspaceId("workspace-repeat"),
    first
  )
})

test("sync rejects unknown variants and keeps the current local row unchanged", async () => {
  const { repository, service } = createSyncHarness(() =>
    createSubscriptionApiResponse({
      subscriptionId: "sub_unknown",
      customerId: "cus_unknown",
      variantId: "variant_unknown",
      status: "active",
      renewsAt: "2026-09-01T00:00:00.000Z",
    })
  )

  const existing: WorkspaceSubscriptionState = {
    workspaceId: "workspace-unknown",
    lemonSqueezySubscriptionId: "sub_unknown",
    lemonSqueezyCustomerId: "cus_existing",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
  }

  await repository.upsert(existing)

  await assert.rejects(
    service.sync({
      workspaceId: "workspace-unknown",
      subscriptionId: "sub_unknown",
    }),
    /Unknown Lemon Squeezy variant id/
  )
  assert.deepEqual(
    await repository.findByWorkspaceId("workspace-unknown"),
    existing
  )
})
