import "server-only"

import { handleMcpProtectedResourceMetadataRequest } from "@/server/mcp/mcp-oauth-metadata"

export const GET = handleMcpProtectedResourceMetadataRequest
