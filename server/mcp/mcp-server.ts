import "server-only"

import { MCP_OAUTH_SECURITY_SCHEMES } from "@/lib/mcp-oauth"
import { mcpAuditService } from "@/server/mcp/audit/mcp-audit.service"
import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import { mcpTrackableService } from "@/server/mcp/services/mcp-trackable.service"
import { ApiKeyCreateTool } from "@/server/mcp/tools/api-key-create.tool"
import { ApiKeyListTool } from "@/server/mcp/tools/api-key-list.tool"
import { ApiKeyRevokeTool } from "@/server/mcp/tools/api-key-revoke.tool"
import { FormCreationTool } from "@/server/mcp/tools/form-creation.tool"
import { FormGetTool } from "@/server/mcp/tools/form-get.tool"
import { FormSharingTool } from "@/server/mcp/tools/form-sharing.tool"
import { LogDetailTool } from "@/server/mcp/tools/log-detail.tool"
import { LogSearchTool } from "@/server/mcp/tools/log-search.tool"
import { ResponseDetailTool } from "@/server/mcp/tools/response-detail.tool"
import { ResponseListTool } from "@/server/mcp/tools/response-list.tool"
import { ResponseStatsTool } from "@/server/mcp/tools/response-stats.tool"
import { TrackableCreationTool } from "@/server/mcp/tools/trackable-creation.tool"
import { TrackableDiscoveryTool } from "@/server/mcp/tools/trackable-discovery.tool"
import { FindTrackablesTool } from "@/server/mcp/tools/trackable-find.tool"
import { WorkspaceDiscoveryTool } from "@/server/mcp/tools/workspace-discovery.tool"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/** All available MCP tool instances, constructed once at module load. */
const allTools = [
  new WorkspaceDiscoveryTool(),
  new FindTrackablesTool(mcpTrackableService, mcpAuditService),
  new TrackableDiscoveryTool(),
  new TrackableCreationTool(),
  new LogSearchTool(),
  new LogDetailTool(),
  new FormCreationTool(),
  new FormGetTool(),
  new FormSharingTool(),
  new ResponseListTool(),
  new ResponseDetailTool(),
  new ResponseStatsTool(),
  new ApiKeyListTool(),
  new ApiKeyCreateTool(),
  new ApiKeyRevokeTool(),
]

/**
 * Builds a fully configured McpServer for a single authenticated request.
 *
 * The auth context is captured via closure by each tool handler.
 * Only tools that the token's capability grants allow are registered,
 * so the agent's tool list is scoped to what the token permits.
 *
 * Called once per incoming MCP request — stateless, no shared state.
 */
export function buildMcpServer(authContext: McpAuthContext): McpServer {
  const server = new McpServer(
    {
      name: "trackables",
      version: "1.0.0",
    },
    {
      instructions:
        "You are an assistant with access to the user's Trackables account data. " +
        "Only call tools when the user is asking about their specific account data — workspaces, trackables, forms, responses, logs, or API keys. " +
        "Do not call any tool to answer general questions about how Trackables works, what features exist, terminology explanations, setup guidance, or any question that can be answered from your own knowledge. " +
        "Do not call any tool for requests unrelated to Trackables. " +
        "When in doubt, answer from knowledge first and only invoke a tool if live account data is genuinely required to respond.",
    }
  )

  // Every tool uses the same OAuth settings, so we add them once here.
  const originalRegisterTool = server.registerTool.bind(server)
  server.registerTool = ((name: string, config: Record<string, unknown>, cb) =>
    originalRegisterTool(
      name,
      {
        ...config,
        _meta: {
          ...(typeof config._meta === "object" && config._meta !== null
            ? config._meta
            : {}),
          securitySchemes: MCP_OAUTH_SECURITY_SCHEMES,
        },
      },
      cb
    )) as typeof server.registerTool

  for (const tool of allTools) {
    // Only register tools the token is permitted to use
    if (authContext.canUseTool(tool.name)) {
      tool.register(server, authContext)
    }
  }

  return server
}
