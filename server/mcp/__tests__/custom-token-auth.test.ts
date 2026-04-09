import assert from "node:assert/strict"
import test, { before, mock } from "node:test"

import type { db as DbType } from "@/db"
import type { validateCustomMcpToken as ValidateCustomMcpTokenType } from "@/server/mcp/auth/custom-token-auth"
import { registerServerOnlyMock } from "@/support/module-mocks/register-module-mocks"

registerServerOnlyMock()

let db: typeof DbType
let validateCustomMcpToken: typeof ValidateCustomMcpTokenType

before(async () => {
  ;({ db } = await import("@/db"))
  ;({ validateCustomMcpToken } =
    await import("@/server/mcp/auth/custom-token-auth"))
})

test("validateCustomMcpToken hydrates stored capabilities into auth context", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(
    db.query.mcpAccessTokens,
    "findFirst",
    async () =>
      ({
        id: "token-1",
        createdByUserId: "user-1",
        usageCount: 3,
        expiresAt: null,
        capabilities: {
          tools: ["find_trackables"],
          workspaceIds: ["workspace-1"],
          trackableIds: ["trackable-1"],
        },
      }) as never
  )
  mock.method(
    db,
    "update",
    () =>
      ({
        set() {
          return {
            where() {
              return Promise.resolve()
            },
          }
        },
      }) as never
  )

  const authContext = await validateCustomMcpToken(
    "trk_mcp_12345678901234567890123456789012"
  )

  assert.ok(authContext)
  assert.equal(authContext.userId, "user-1")
  assert.equal(authContext.canUseTool("find_trackables"), true)
  assert.equal(authContext.canUseTool("list_trackables"), false)
  assert.equal(authContext.canAccessWorkspace("workspace-1"), true)
  assert.equal(authContext.canAccessWorkspace("workspace-2"), false)
  assert.equal(authContext.canAccessTrackable("trackable-1"), true)
  assert.equal(authContext.canAccessTrackable("trackable-2"), false)
})

test("validateCustomMcpToken rejects expired tokens", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(
    db.query.mcpAccessTokens,
    "findFirst",
    async () =>
      ({
        id: "token-1",
        createdByUserId: "user-1",
        usageCount: 3,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        capabilities: { tools: ["find_trackables"] },
      }) as never
  )
  mock.method(
    db,
    "update",
    () =>
      ({
        set() {
          return {
            where() {
              return Promise.resolve()
            },
          }
        },
      }) as never
  )

  const authContext = await validateCustomMcpToken(
    "trk_mcp_12345678901234567890123456789012"
  )

  assert.equal(authContext, null)
})
