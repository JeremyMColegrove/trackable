import "server-only"

import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client"

import { getAppOrigin, getMcpResourceUrl } from "@/lib/mcp-oauth"

const resourceClient = oauthProviderResourceClient().getActions()

export async function getMcpProtectedResourceMetadata() {
  return resourceClient.getProtectedResourceMetadata({
    resource: getMcpResourceUrl(),
    authorization_servers: [getAppOrigin()],
  })
}

export async function handleMcpProtectedResourceMetadataRequest() {
  const metadata = await getMcpProtectedResourceMetadata()

  return Response.json(metadata, {
    headers: {
      "Cache-Control":
        "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400",
    },
  })
}
