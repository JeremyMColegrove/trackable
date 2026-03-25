import assert from "node:assert/strict"
import test from "node:test"

import {
  SubscriptionService,
} from "@/server/subscriptions/subscription.service"
import type {
  WorkspaceSubscriptionRepository,
} from "@/server/subscriptions/subscription.repository"
import type {
  WorkspaceSubscriptionState,
  WorkspaceSubscriptionUpsertInput,
} from "@/server/subscriptions/types"

class InMemoryWorkspaceSubscriptionRepository
  implements WorkspaceSubscriptionRepository
{
  private readonly subscriptions = new Map<string, WorkspaceSubscriptionState>()

  async findByWorkspaceId(workspaceId: string) {
    return this.subscriptions.get(workspaceId) ?? null
  }

  async upsert(input: WorkspaceSubscriptionUpsertInput) {
    this.subscriptions.set(input.workspaceId, input)
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

test("ensureFreeWorkspaceSubscription creates a free subscription row for new workspaces", async () => {
  const { repository, service } = createService()

  await service.ensureFreeWorkspaceSubscription("workspace-1")

  assert.deepEqual(await repository.findByWorkspaceId("workspace-1"), {
    workspaceId: "workspace-1",
    lemonSqueezySubscriptionId: null,
    lemonSqueezyCustomerId: null,
    variantId: null,
    tier: "free",
    status: "active",
    currentPeriodEnd: null,
  })
})

test("getWorkspaceTier returns free for new workspaces without a subscription row", async () => {
  const { service } = createService()

  assert.equal(await service.getWorkspaceTier("workspace-2"), "free")
})

test("getWorkspaceTier returns the paid tier for active workspace subscriptions", async () => {
  const { repository, service } = createService()

  await repository.upsert({
    workspaceId: "workspace-3",
    lemonSqueezySubscriptionId: "sub_123",
    lemonSqueezyCustomerId: "cus_123",
    variantId: "variant_plus",
    tier: "plus",
    status: "active",
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
  })

  assert.equal(await service.getWorkspaceTier("workspace-3"), "plus")
})

test("getWorkspaceTier falls back to free when the stored subscription is inactive", async () => {
  const { repository, service } = createService()

  await repository.upsert({
    workspaceId: "workspace-4",
    lemonSqueezySubscriptionId: "sub_456",
    lemonSqueezyCustomerId: "cus_456",
    variantId: "variant_pro",
    tier: "pro",
    status: "past_due",
    currentPeriodEnd: null,
  })

  assert.equal(await service.getWorkspaceTier("workspace-4"), "free")
})

test("subscriptions disabled mode exposes full access without persisting rows", async () => {
  const repository = new InMemoryWorkspaceSubscriptionRepository()
  const service = new SubscriptionService(repository, () => false)

  assert.equal(await service.getWorkspaceTier("workspace-5"), "pro")
  assert.deepEqual(await service.getWorkspaceSubscription("workspace-5"), {
    workspaceId: "workspace-5",
    lemonSqueezySubscriptionId: null,
    lemonSqueezyCustomerId: null,
    variantId: null,
    tier: "pro",
    status: "active",
    currentPeriodEnd: null,
  })
  assert.equal(await repository.findByWorkspaceId("workspace-5"), null)
})
