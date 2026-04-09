/**
 * Creates a confidential OAuth client for ChatGPT (or any MCP client) using
 * Better Auth's server-side admin client registration API.
 *
 * This avoids direct writes to Better Auth's managed OAuth tables and keeps
 * client secret generation, storage, and lifecycle inside the library.
 *
 * Usage:
 *   npx tsx scripts/setup-mcp-oauth-client.ts <chatgpt-redirect-uri>
 *
 * Example:
 *   npx tsx scripts/setup-mcp-oauth-client.ts https://chatgpt.com/connector/oauth/abc123
 */

import "dotenv/config"
import { auth } from "@/lib/auth"

const redirectUri = process.argv[2]
if (!redirectUri) {
  console.error(
    "Usage: npx tsx scripts/setup-mcp-oauth-client.ts <chatgpt-redirect-uri>"
  )
  console.error(
    "Example: npx tsx scripts/setup-mcp-oauth-client.ts https://chatgpt.com/connector/oauth/abc123"
  )
  process.exit(1)
}

async function main() {
  const result = await auth.api.adminCreateOAuthClient({
    body: {
      client_name: "ChatGPT MCP Connector",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      token_endpoint_auth_method: "client_secret_post",
    },
  })

  const clientId = result.client_id
  const clientSecret = result.client_secret

  if (!clientId || !clientSecret) {
    throw new Error(
      "Better Auth did not return the created OAuth client credentials."
    )
  }

  console.log("\nChatGPT OAuth client registered!\n")
  console.log("── Step 1: add to your .env ──────────────────────────────────")
  console.log(`MCP_OAUTH_CLIENT_ID=${clientId}`)
  console.log(`MCP_OAUTH_CLIENT_SECRET=${clientSecret}`)
  console.log("")
  console.log("── Step 2: enter in ChatGPT connector settings ───────────────")
  console.log(`Client ID:     ${clientId}`)
  console.log(`Client Secret: ${clientSecret}`)
  console.log(
    `Auth URL:      ${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/authorize`
  )
  console.log(
    `Token URL:     ${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/token`
  )
  console.log("")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
