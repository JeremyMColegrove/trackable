import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import { mcpAuditService } from "@/server/mcp/audit/mcp-audit.service"
import {
  buildMcpErrorContent,
  McpToolError,
  type McpErrorCode,
} from "@/server/mcp/errors/mcp-errors"
import { mcpWorkspaceService } from "@/server/mcp/services/mcp-workspace.service"
import type { McpTool } from "@/server/mcp/tools/base-tool"

export class WorkspaceDiscoveryTool implements McpTool {
  readonly name = "list_workspaces" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "list_workspaces",
      {
        description:
          "Use this when you need to discover which workspaces are accessible to this token, " +
          "or when you need to resolve a workspace_id before calling a workspace-scoped tool. " +
          "Returns: { workspaces: [ { id, name, slug, role, canCreateTrackables, isActive } ] }. " +
          "role is one of: owner, admin, member, viewer. " +
          "canCreateTrackables indicates whether the user has permission to create trackables in that workspace. " +
          "isActive marks the default workspace used by all other tools when workspace_id is omitted. " +
          "Returns an empty array if the token has no accessible workspaces. " +
          "Do not call this to retrieve trackables, forms, or logs — use list_trackables or find_trackables for that. " +
          "Do not call this preemptively before every tool invocation — only call it when you genuinely need to resolve a workspace_id you do not already have. " +
          "Do not call this to get user profile info, billing details, subscription status, account age, or plan information — those fields are not in this response and cannot be retrieved via MCP. " +
          "Do not call this to answer general questions about how Trackables works, feature explanations, or account setup guidance — those require no tool calls.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {},
      },
      async () => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("list_workspaces")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use list_workspaces."
            )
          }

          const workspaces =
            await mcpWorkspaceService.listAccessible(authContext)

          mcpAuditService.record({
            userId: authContext.userId,
            tool: "list_workspaces",
            success: true,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString(),
          })

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ workspaces }, null, 2),
              },
            ],
          }
        } catch (error) {
          mcpAuditService.record({
            userId: authContext.userId,
            tool: "list_workspaces",
            success: false,
            errorCode: (error as { code?: McpErrorCode }).code,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString(),
          })

          return {
            content: [
              { type: "text" as const, text: buildMcpErrorContent(error) },
            ],
          }
        }
      }
    )
  }
}
