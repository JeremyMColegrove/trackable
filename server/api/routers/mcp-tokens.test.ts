import assert from "node:assert/strict"
import test, { before, mock } from "node:test"

import { TRPCError } from "@trpc/server"

import type { db as DbType } from "@/db"
import { registerServerOnlyMock } from "@/support/module-mocks/register-module-mocks"

process.env.BETTER_AUTH_URL ??= "http://localhost:3000"
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000"

registerServerOnlyMock()

let db: typeof DbType
let mcpTokensRouter: typeof import("@/server/api/routers/mcp-tokens").mcpTokensRouter

before(async () => {
  ;({ db } = await import("@/db"))
  ;({ mcpTokensRouter } = await import("@/server/api/routers/mcp-tokens"))
})

function createCaller() {
  return mcpTokensRouter.createCaller({
    auth: {
      userId: "user-1",
    },
  } as never)
}

function mockLegacyRevocationUpdate() {
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
}

test("mcpTokens.createToken accepts valid explicit capabilities", async (t) => {
  t.after(() => mock.restoreAll())

  mockLegacyRevocationUpdate()
  mock.method(
    db.query.workspaceMembers,
    "findMany",
    async () =>
      [
        {
          workspaceId: "11111111-1111-4111-8111-111111111111",
          role: "owner",
          workspace: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Alpha",
            slug: "alpha",
          },
        },
      ] as never
  )
  mock.method(
    db.query.trackableItems,
    "findMany",
    async () =>
      [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          workspaceId: "11111111-1111-4111-8111-111111111111",
          name: "Survey",
          kind: "survey",
        },
      ] as never
  )
  mock.method(
    db,
    "insert",
    () =>
      ({
        values() {
          return Promise.resolve()
        },
      }) as never
  )

  const result = await createCaller().createToken({
    name: "Scoped Token",
    expiresAt: null,
    capabilities: {
      tools: ["find_trackables"],
      workspaceIds: ["11111111-1111-4111-8111-111111111111"],
      trackableIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    },
  })

  assert.equal(result.name, "Scoped Token")
  assert.equal(result.token.startsWith("trk_mcp_"), true)
  assert.deepEqual(result.capabilities, {
    tools: ["find_trackables"],
    workspaceIds: ["11111111-1111-4111-8111-111111111111"],
    trackableIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  })
})

test("mcpTokens.createToken rejects invalid tool names", async () => {
  await assert.rejects(
    () =>
      createCaller().createToken({
        name: "Bad Token",
        expiresAt: null,
        capabilities: {
          tools: ["not_a_real_tool"],
        },
      } as never),
    (error: unknown) => {
      assert.ok(error instanceof TRPCError)
      assert.equal(error.code, "BAD_REQUEST")
      return true
    }
  )
})

test("mcpTokens.createToken rejects malformed UUIDs", async () => {
  await assert.rejects(
    () =>
      createCaller().createToken({
        name: "Bad Token",
        expiresAt: null,
        capabilities: {
          tools: ["find_trackables"],
          workspaceIds: ["not-a-uuid"],
        },
      } as never),
    (error: unknown) => {
      assert.ok(error instanceof TRPCError)
      assert.equal(error.code, "BAD_REQUEST")
      return true
    }
  )
})

test("mcpTokens.createToken rejects empty tool selections", async () => {
  await assert.rejects(
    () =>
      createCaller().createToken({
        name: "Bad Token",
        expiresAt: null,
        capabilities: {
          tools: [],
        },
      } as never),
    (error: unknown) => {
      assert.ok(error instanceof TRPCError)
      assert.equal(error.code, "BAD_REQUEST")
      return true
    }
  )
})
