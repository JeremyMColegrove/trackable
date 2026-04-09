import assert from "node:assert/strict"
import test, { before } from "node:test"

import { McpAuthContextImpl } from "@/server/mcp/auth/mcp-auth-context"
import { registerServerOnlyMock } from "@/support/module-mocks/register-module-mocks"

registerServerOnlyMock()

let buildMcpServer: typeof import("@/server/mcp/mcp-server").buildMcpServer

before(async () => {
  ;({ buildMcpServer } = await import("@/server/mcp/mcp-server"))
})

test("buildMcpServer only registers tools permitted by the auth context", () => {
  const server = buildMcpServer(
    new McpAuthContextImpl({
      userId: "user-1",
      tools: ["find_trackables", "list_workspaces"],
    })
  ) as unknown as {
    _registeredTools: Record<
      string,
      {
        _meta?: { securitySchemes?: Array<{ type: string; scopes?: string[] }> }
        enabled: boolean
      }
    >
  }

  assert.deepEqual(Object.keys(server._registeredTools).sort(), [
    "find_trackables",
    "list_workspaces",
  ])
  assert.deepEqual(
    server._registeredTools.find_trackables?._meta?.securitySchemes,
    [{ type: "oauth2", scopes: ["openid"] }]
  )
})
