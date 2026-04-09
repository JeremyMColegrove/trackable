import assert from "node:assert/strict"
import test, { before, mock } from "node:test"

import type { db as DbType } from "@/db"
import type {
  ensureUserProvisioned as EnsureUserProvisionedType,
  syncAuthUserProfile as SyncAuthUserProfileType,
} from "@/server/user-provisioning"
import { registerServerOnlyMock } from "@/support/module-mocks/register-module-mocks"

registerServerOnlyMock()

let db: typeof DbType
let syncAuthUserProfile: typeof SyncAuthUserProfileType
let ensureUserProvisioned: typeof EnsureUserProvisionedType

type InsertedUser = {
  id: string
  primaryEmail: string
  displayName: string | null
  imageUrl: string | null
}

type UpdatedUser = {
  primaryEmail: string
  displayName: string | null
  imageUrl: string | null
  updatedAt: Date
}

before(async () => {
  ;({ db } = await import("@/db"))
  ;({ syncAuthUserProfile, ensureUserProvisioned } =
    await import("@/server/user-provisioning"))
})

test("syncAuthUserProfile upserts the app user without creating a workspace", async (t) => {
  t.after(() => mock.restoreAll())

  let insertedUser: InsertedUser | null = null
  let updatedUser: UpdatedUser | null = null

  mock.method(
    db,
    "insert",
    () =>
      ({
        values(values: InsertedUser) {
          insertedUser = values

          return {
            onConflictDoUpdate({
              set,
            }: {
              set: UpdatedUser
            }) {
              updatedUser = set
              return Promise.resolve()
            },
          }
        },
      }) as never
  )

  await syncAuthUserProfile({
    id: "user-1",
    email: "updated@example.com",
    name: "Updated User",
    image: "https://example.com/updated.png",
  })

  assert.deepEqual(insertedUser, {
    id: "user-1",
    primaryEmail: "updated@example.com",
    displayName: "Updated User",
    imageUrl: "https://example.com/updated.png",
  })
  if (!updatedUser) {
    assert.fail("Expected syncAuthUserProfile to perform an upsert update.")
  }

  const persistedUser = updatedUser as UpdatedUser

  assert.equal(persistedUser.primaryEmail, "updated@example.com")
  assert.equal(persistedUser.displayName, "Updated User")
  assert.equal(persistedUser.imageUrl, "https://example.com/updated.png")
  assert.ok(persistedUser.updatedAt instanceof Date)
})

test("ensureUserProvisioned repairs a missing app user row without creating a workspace", async (t) => {
  t.after(() => mock.restoreAll())

  let insertedUser: InsertedUser | null = null

  mock.method(
    db.query.user,
    "findFirst",
    async () =>
      ({
        id: "user-2",
        email: "repair@example.com",
        name: "Repair User",
        image: null,
      }) as never
  )
  mock.method(
    db,
    "insert",
    () =>
      ({
        values(values: InsertedUser) {
          insertedUser = values

          return {
            onConflictDoUpdate() {
              return Promise.resolve()
            },
          }
        },
      }) as never
  )

  await ensureUserProvisioned("user-2")

  assert.deepEqual(insertedUser, {
    id: "user-2",
    primaryEmail: "repair@example.com",
    displayName: "Repair User",
    imageUrl: null,
  })
})
