import assert from "node:assert/strict"
import test from "node:test"

test("MCP OAuth helpers derive stable URLs from the public app origin", async () => {
  process.env.BETTER_AUTH_URL = "https://trackables.example.com/"
  delete process.env.NEXT_PUBLIC_APP_URL

  const {
    MCP_OAUTH_SECURITY_SCHEMES,
    getAppOrigin,
    getMcpProtectedResourceMetadataUrl,
    getMcpResourceUrl,
  } = await import("@/lib/mcp-oauth")

  assert.equal(getAppOrigin(), "https://trackables.example.com")
  assert.equal(getMcpResourceUrl(), "https://trackables.example.com/api/mcp")
  assert.equal(
    getMcpProtectedResourceMetadataUrl(),
    "https://trackables.example.com/.well-known/oauth-protected-resource/api/mcp"
  )
  assert.deepEqual(MCP_OAUTH_SECURITY_SCHEMES, [
    { type: "oauth2", scopes: ["openid"] },
  ])
})
