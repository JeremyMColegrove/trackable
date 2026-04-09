import assert from "node:assert/strict"
import test from "node:test"

import { McpAuthContextImpl } from "@/server/mcp/auth/mcp-auth-context"

test("McpAuthContextImpl allows all tools when configured with all", () => {
  const authContext = new McpAuthContextImpl({
    userId: "user-1",
    tools: "all",
  })

  assert.equal(authContext.canUseTool("find_trackables"), true)
  assert.equal(authContext.canUseTool("create_api_key"), true)
})

test("McpAuthContextImpl enforces tool allowlists", () => {
  const authContext = new McpAuthContextImpl({
    userId: "user-1",
    tools: ["find_trackables", "list_workspaces"],
  })

  assert.equal(authContext.canUseTool("find_trackables"), true)
  assert.equal(authContext.canUseTool("create_api_key"), false)
})

test("McpAuthContextImpl enforces workspace allowlists", () => {
  const authContext = new McpAuthContextImpl({
    userId: "user-1",
    tools: "all",
    workspaceIds: ["workspace-1"],
  })

  assert.equal(authContext.canAccessWorkspace("workspace-1"), true)
  assert.equal(authContext.canAccessWorkspace("workspace-2"), false)
})

test("McpAuthContextImpl enforces trackable allowlists", () => {
  const authContext = new McpAuthContextImpl({
    userId: "user-1",
    tools: "all",
    trackableIds: ["trackable-1"],
  })

  assert.equal(authContext.canAccessTrackable("trackable-1"), true)
  assert.equal(authContext.canAccessTrackable("trackable-2"), false)
})

test("McpAuthContextImpl supports combined workspace and trackable restrictions", () => {
  const authContext = new McpAuthContextImpl({
    userId: "user-1",
    tools: ["find_trackables"],
    workspaceIds: ["workspace-1"],
    trackableIds: ["trackable-1"],
  })

  assert.equal(authContext.canUseTool("find_trackables"), true)
  assert.equal(authContext.canUseTool("list_trackables"), false)
  assert.equal(authContext.canAccessWorkspace("workspace-1"), true)
  assert.equal(authContext.canAccessWorkspace("workspace-2"), false)
  assert.equal(authContext.canAccessTrackable("trackable-1"), true)
  assert.equal(authContext.canAccessTrackable("trackable-2"), false)
})
