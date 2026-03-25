import assert from "node:assert/strict"
import test from "node:test"

import { applyWorkspaceCreationSideEffects } from "@/server/workspace-creation-side-effects"

test("workspace creation side effects initialize a free subscription and clear caches", async () => {
  const calls: string[] = []

  await applyWorkspaceCreationSideEffects(
    {
      workspaceId: "workspace-1",
      userId: "user-1",
      setActive: true,
    },
    {
      ensureFreeWorkspaceSubscription: async (workspaceId) => {
        calls.push(`subscription:${workspaceId}`)
      },
      clearMembershipsCache: async (userId) => {
        calls.push(`memberships:${userId}`)
      },
      clearActiveWorkspaceCache: async (userId) => {
        calls.push(`active:${userId}`)
      },
    }
  )

  assert.deepEqual(calls, [
    "subscription:workspace-1",
    "memberships:user-1",
    "active:user-1",
  ])
})
