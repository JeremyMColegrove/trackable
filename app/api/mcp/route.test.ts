import assert from "node:assert/strict"
import test, { before } from "node:test"

import { registerServerOnlyMock } from "@/support/module-mocks/register-module-mocks"

registerServerOnlyMock()

let GET: typeof import("@/app/api/mcp/route").GET
let OPTIONS: typeof import("@/app/api/mcp/route").OPTIONS

before(async () => {
  process.env.BETTER_AUTH_URL = "https://trackables.example.com"
  delete process.env.NEXT_PUBLIC_APP_URL

  ;({ GET, OPTIONS } = await import("@/app/api/mcp/route"))
})

test("mcp OPTIONS exposes the auth challenge header to browser clients", async () => {
  const response = await OPTIONS()

  assert.equal(response.status, 204)
  assert.equal(
    response.headers.get("Access-Control-Expose-Headers"),
    "WWW-Authenticate"
  )
})

test("mcp GET returns a bearer challenge that points clients at resource metadata", async () => {
  const response = await GET(new Request("https://example.com/api/mcp"))

  assert.equal(response.status, 401)
  assert.equal(
    response.headers.get("Access-Control-Expose-Headers"),
    "WWW-Authenticate"
  )
  assert.match(
    response.headers.get("WWW-Authenticate") ?? "",
    /^Bearer resource_metadata=".*\/\.well-known\/oauth-protected-resource\/api\/mcp"$/
  )
})
