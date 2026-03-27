import assert from "node:assert/strict"
import test from "node:test"

import { getLimitsForTier } from "@/lib/subscription-plans"
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

test("ensureWorkspaceSubscription inserts a free row when one is missing", async () => {
  const { repository, service } = createService()

  const subscription = await service.ensureWorkspaceSubscription("workspace-1")

  assert.deepEqual(subscription, {
    workspaceId: "workspace-1",
    lemonSqueezySubscriptionId: null,
    lemonSqueezyCustomerId: null,
    variantId: null,
    tier: "free",
    status: "active",
    currentPeriodEnd: null,
  })
  assert.deepEqual(
    await repository.findByWorkspaceId("workspace-1"),
    subscription
  )
})

test("getState resolves missing rows as free and repairs the local row", async () => {
  const { repository, service } = createService()

  const state = await service.getState("workspace-2")

  assert.equal(state.planTier, "free")
  assert.equal(state.effectiveTier, "free")
  assert.equal(state.status, "active")
  assert.equal(state.isFree, true)
  assert.deepEqual(state.limits, getLimitsForTier("free"))
  assert.deepEqual(await repository.findByWorkspaceId("workspace-2"), {
    workspaceId: "workspace-2",
    lemonSqueezySubscriptionId: null,
    lemonSqueezyCustomerId: null,
    variantId: null,
    tier: "free",
    status: "active",
    currentPeriodEnd: null,
  })
})

test("getState preserves paid plan tier and limits for active subscriptions", async () => {
  const { repository, service } = createService()

  await repository.upsert({
    workspaceId: "workspace-3",
    lemonSqueezySubscriptionId: "sub_plus",
    lemonSqueezyCustomerId: "cus_plus",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
  })

  const state = await service.getState("workspace-3")

  assert.equal(state.planTier, "plus")
  assert.equal(state.effectiveTier, "plus")
  assert.equal(state.isFree, false)
  assert.deepEqual(state.limits, getLimitsForTier("plus"))
})

test("getState falls back to free limits when the stored subscription is inactive", async () => {
  const { repository, service } = createService()

  await repository.upsert({
    workspaceId: "workspace-4",
    lemonSqueezySubscriptionId: "sub_pro",
    lemonSqueezyCustomerId: "cus_pro",
    variantId: "67890",
    tier: "pro",
    status: "expired",
    currentPeriodEnd: new Date("2026-05-10T00:00:00.000Z"),
  })

  const state = await service.getState("workspace-4")

  assert.equal(state.planTier, "pro")
  assert.equal(state.effectiveTier, "free")
  assert.equal(state.status, "expired")
  assert.equal(state.isFree, true)
  assert.deepEqual(state.limits, getLimitsForTier("free"))
})

test("getWorkspaceTier and getWorkspaceLimits resolve each tier consistently", async () => {
  const { repository, service } = createService()

  await repository.upsert({
    workspaceId: "workspace-free",
    lemonSqueezySubscriptionId: null,
    lemonSqueezyCustomerId: null,
    variantId: null,
    tier: "free",
    status: "active",
    currentPeriodEnd: null,
  })
  await repository.upsert({
    workspaceId: "workspace-plus",
    lemonSqueezySubscriptionId: "sub_plus",
    lemonSqueezyCustomerId: "cus_plus",
    variantId: "12345",
    tier: "plus",
    status: "active",
    currentPeriodEnd: null,
  })
  await repository.upsert({
    workspaceId: "workspace-pro",
    lemonSqueezySubscriptionId: "sub_pro",
    lemonSqueezyCustomerId: "cus_pro",
    variantId: "67890",
    tier: "pro",
    status: "active",
    currentPeriodEnd: null,
  })

  assert.equal(await service.getWorkspaceTier("workspace-free"), "free")
  assert.equal(await service.getWorkspaceTier("workspace-plus"), "plus")
  assert.equal(await service.getWorkspaceTier("workspace-pro"), "pro")
  assert.deepEqual(
    await service.getWorkspaceLimits("workspace-free"),
    getLimitsForTier("free")
  )
  assert.deepEqual(
    await service.getWorkspaceLimits("workspace-plus"),
    getLimitsForTier("plus")
  )
  assert.deepEqual(
    await service.getWorkspaceLimits("workspace-pro"),
    getLimitsForTier("pro")
  )
})

test("disabled billing exposes pro access without persisting rows", async () => {
  const repository = new InMemoryWorkspaceSubscriptionRepository()
  const service = new SubscriptionService(repository, () => false)

  const state = await service.getState("workspace-5")

  assert.equal(state.planTier, "pro")
  assert.equal(state.effectiveTier, "pro")
  assert.equal(state.isFree, false)
  assert.deepEqual(state.limits, getLimitsForTier("pro"))
  assert.equal(await repository.findByWorkspaceId("workspace-5"), null)
})
