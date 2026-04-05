import assert from "node:assert/strict"
import test from "node:test"

import {
  getDefaultTierId,
  getLimitsForTier,
} from "@/lib/subscription-plans"
import { SubscriptionService } from "@/server/subscriptions/subscription.service"
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

function createService(
  repository = new InMemoryWorkspaceSubscriptionRepository()
) {
  return {
    repository,
    service: new SubscriptionService(repository, () => true),
  }
}

test("ensureWorkspaceSubscription inserts a default row when one is missing", async () => {
  const { repository, service } = createService()
  const defaultTierId = getDefaultTierId()

  const subscription = await service.ensureWorkspaceSubscription("workspace-1")

  assert.deepEqual(subscription, {
    workspaceId: "workspace-1",
    lemonSqueezySubscriptionId: null,
    lemonSqueezyCustomerId: null,
    variantId: null,
    tier: defaultTierId,
    status: "active",
    currentPeriodEnd: null,
  })
  assert.deepEqual(
    await repository.findByWorkspaceId("workspace-1"),
    subscription
  )
})

test("getState resolves missing rows as default tier and repairs the local row", async () => {
  const { repository, service } = createService()
  const defaultTierId = getDefaultTierId()

  const state = await service.getState("workspace-2")

  assert.equal(state.planTier, defaultTierId)
  assert.equal(state.effectiveTier, defaultTierId)
  assert.equal(state.status, "active")
  assert.equal(state.isFree, true)
  assert.deepEqual(state.limits, getLimitsForTier(defaultTierId))
  assert.deepEqual(await repository.findByWorkspaceId("workspace-2"), {
    workspaceId: "workspace-2",
    lemonSqueezySubscriptionId: null,
    lemonSqueezyCustomerId: null,
    variantId: null,
    tier: defaultTierId,
    status: "active",
    currentPeriodEnd: null,
  })
})

test("getState preserves stored tier and limits for active subscriptions", async () => {
  const { repository, service } = createService()
  const defaultTierId = getDefaultTierId()

  await repository.upsert({
    workspaceId: "workspace-3",
    lemonSqueezySubscriptionId: "sub_paid",
    lemonSqueezyCustomerId: "cus_paid",
    variantId: "12345",
    tier: "paid-tier",
    status: "active",
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
  })

  const state = await service.getState("workspace-3")

  assert.equal(state.planTier, "paid-tier")
  assert.equal(state.effectiveTier, "paid-tier")
  assert.equal(state.isFree, "paid-tier" === defaultTierId)
})

test("getState falls back to default limits when the stored subscription is inactive", async () => {
  const { repository, service } = createService()
  const defaultTierId = getDefaultTierId()

  await repository.upsert({
    workspaceId: "workspace-4",
    lemonSqueezySubscriptionId: "sub_paid",
    lemonSqueezyCustomerId: "cus_paid",
    variantId: "67890",
    tier: "paid-tier",
    status: "expired",
    currentPeriodEnd: new Date("2026-05-10T00:00:00.000Z"),
  })

  const state = await service.getState("workspace-4")

  assert.equal(state.planTier, "paid-tier")
  assert.equal(state.effectiveTier, defaultTierId)
  assert.equal(state.status, "expired")
  assert.equal(state.isFree, true)
  assert.deepEqual(state.limits, getLimitsForTier(defaultTierId))
})

test("disabled billing exposes default-tier access without persisting rows", async () => {
  const repository = new InMemoryWorkspaceSubscriptionRepository()
  const service = new SubscriptionService(repository, () => false)
  const defaultTierId = getDefaultTierId()

  const state = await service.getState("workspace-5")

  assert.equal(state.planTier, defaultTierId)
  assert.equal(state.effectiveTier, defaultTierId)
  assert.deepEqual(state.limits, getLimitsForTier(defaultTierId))
  assert.equal(await repository.findByWorkspaceId("workspace-5"), null)
})
