import "server-only"

import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import { mcpAuditService } from "@/server/mcp/audit/mcp-audit.service"
import {
  buildMcpErrorContent,
  McpToolError,
  type McpErrorCode,
} from "@/server/mcp/errors/mcp-errors"
import { mcpTrackableService } from "@/server/mcp/services/mcp-trackable.service"
import type { McpTool } from "@/server/mcp/tools/base-tool"

/**
 * list_trackables Tool
 *
 * Discovers trackables accessible to the authenticated MCP token in a selected workspace.
 * Returns summary metadata including kind, activity counts, and UI deep links.
 *
 * Agents should prefer `find_trackables` first when they need to locate an existing trackable
 * across workspaces. Use this tool when the workspace is already known and a workspace-scoped
 * browse is more appropriate.
 */
export class TrackableDiscoveryTool implements McpTool {
  readonly name = "list_trackables" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "list_trackables",
      {
        description:
          "Use this when you already know a workspace_id and want to browse all trackables in it, or when you want to see every trackable in the active workspace. " +
          "If workspace_id is omitted, defaults to the current active workspace. " +
          "Returns: { trackables: [ { id, workspaceId, name, slug, kind, submissionCount, apiUsageCount, lastActivityAt, adminUrl } ] }. " +
          "kind is either 'survey' or 'api_ingestion'. lastActivityAt is an ISO 8601 timestamp or null. adminUrl is a direct deep link into the admin UI. " +
          "Returns an empty array when no trackables exist in the workspace — this is not an error. " +
          "Do not use this for cross-workspace search — use find_trackables instead when searching by name or across workspaces. " +
          "Do not call this to get form field definitions, response data, or log events — use get_form, list_responses, or search_logs for those. " +
          "Do not call this to answer general questions about how Trackables works, feature explanations, or account setup guidance — those require no tool calls.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          workspace_id: z
            .string()
            .uuid("workspace_id must be a valid UUID")
            .optional()
            .describe(
              "Optional UUID of the workspace to list trackables from. " +
                "Defaults to the current active user workspace when omitted."
            ),
          kind: z
            .enum(["survey", "api_ingestion"])
            .optional()
            .describe(
              'Optional filter: "survey" returns form/survey trackables, ' +
                '"api_ingestion" returns log trackables.'
            ),
          include_archived: z
            .boolean()
            .optional()
            .default(false)
            .describe(
              "Set to true to include archived trackables. Default: false."
            ),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("list_trackables")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use list_trackables."
            )
          }

          const items = await mcpTrackableService.listAccessible(authContext, {
            workspaceId: args.workspace_id,
            kind: args.kind,
            includeArchived: args.include_archived,
          })

          mcpAuditService.record({
            userId: authContext.userId,
            workspaceId: args.workspace_id,
            tool: "list_trackables",
            success: true,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString(),
          })

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ trackables: items }, null, 2),
              },
            ],
          }
        } catch (error) {
          mcpAuditService.record({
            userId: authContext.userId,
            workspaceId: args.workspace_id,
            tool: "list_trackables",
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
