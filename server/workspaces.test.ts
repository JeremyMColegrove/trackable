import assert from "node:assert/strict"
import test, { before, mock } from "node:test"

import { TRPCError } from "@trpc/server"

import type { db as DbType } from "@/db"
import type { userActiveWorkspaceCache as UserActiveWorkspaceCacheType } from "@/server/redis/access-control-cache.repository"
import type { applyWorkspaceCreationSideEffects as ApplyWorkspaceCreationSideEffectsType } from "@/server/workspace-creation-side-effects"
import type { assertCanCreateWorkspaceWithCount as AssertCanCreateWorkspaceWithCountType } from "@/server/workspace-creation-limit"
import type { createDefaultWorkspaceForUser as CreateDefaultWorkspaceForUserType } from "@/server/workspaces"
import { registerServerOnlyMock } from "@/support/module-mocks/register-module-mocks"

registerServerOnlyMock()

let db: typeof DbType
let userActiveWorkspaceCache: typeof UserActiveWorkspaceCacheType
let applyWorkspaceCreationSideEffects: typeof ApplyWorkspaceCreationSideEffectsType
let assertCanCreateWorkspaceWithCount: typeof AssertCanCreateWorkspaceWithCountType
let createDefaultWorkspaceForUser: typeof CreateDefaultWorkspaceForUserType

before(async () => {
  ;({ db } = await import("@/db"))
  ;({ userActiveWorkspaceCache } =
    await import("@/server/redis/access-control-cache.repository"))
  ;({ applyWorkspaceCreationSideEffects } =
    await import("@/server/workspace-creation-side-effects"))
  ;({ assertCanCreateWorkspaceWithCount } =
    await import("@/server/workspace-creation-limit"))
  ;({ createDefaultWorkspaceForUser } = await import("@/server/workspaces"))
})

test("workspace creation side effects initialize a free subscription and clear caches", async () => {
  const calls: string[] = []

  await applyWorkspaceCreationSideEffects(
    {
      workspaceId: "workspace-1",
      userId: "user-1",
      setActive: true,
    },
    {
      ensureWorkspaceSubscription: async (workspaceId) => {
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

test("workspace creation is blocked once the creator reaches the free-tier cap", () => {
  assert.doesNotThrow(() => assertCanCreateWorkspaceWithCount(2, 3))

  assert.throws(
    () => assertCanCreateWorkspaceWithCount(3, 3),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.message ===
        "You have reached the maximum of 3 workspaces you can create on the free tier."
  )
})

test("createDefaultWorkspaceForUser reuses an existing membership instead of creating another workspace", async (t) => {
  t.after(() => mock.restoreAll())

  let updatedWorkspaceId: string | null = null

  mock.method(userActiveWorkspaceCache, "get", async () => "workspace-2")
  mock.method(userActiveWorkspaceCache, "delete", async () => undefined)
  mock.method(
    db.query.workspaceMembers,
    "findMany",
    async () => [{ workspaceId: "workspace-1" }] as never
  )
  mock.method(db, "transaction", async () => {
    throw new Error(
      "Default workspace creation should not run when membership exists."
    )
  })
  mock.method(
    db,
    "update",
    () =>
      ({
        set(values: { activeWorkspaceId: string }) {
          updatedWorkspaceId = values.activeWorkspaceId

          return {
            where: async () => undefined,
          }
        },
      }) as never
  )

  const workspaceId = await createDefaultWorkspaceForUser({
    userId: "user-1",
    primaryEmail: "user@example.com",
    displayName: "Jamie",
  })

  assert.equal(workspaceId, "workspace-1")
  assert.equal(updatedWorkspaceId, "workspace-1")
})
