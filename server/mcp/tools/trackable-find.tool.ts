import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import {
  buildMcpErrorContent,
  McpToolError,
  type McpErrorCode,
} from "@/server/mcp/errors/mcp-errors"
import type { McpAuditService } from "@/server/mcp/audit/mcp-audit.service"
import type { McpTrackableService } from "@/server/mcp/services/mcp-trackable.service"
import type { McpTool } from "@/server/mcp/tools/base-tool"

/**
 * find_trackables Tool
 *
 * Searches accessible trackables across all workspaces the MCP token can access.
 * This is the preferred discovery step before agents act on an existing trackable.
 */
export class FindTrackablesTool implements McpTool {
  readonly name = "find_trackables" as const

  constructor(
    private readonly trackableService: Pick<McpTrackableService, "findAccessible">,
    private readonly auditService: Pick<McpAuditService, "record">
  ) {}

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "find_trackables",
      {
        description:
          "Use this when you need to locate an existing trackable by name or kind before acting on it. " +
          "Searches across all accessible workspaces or within a specific one when workspace_id is provided. " +
          "Returns: { results: [ { trackable: { id, workspaceId, name, slug, kind, submissionCount, apiUsageCount, lastActivityAt, adminUrl }, workspace: { id, name, slug, role, canCreateTrackables, isActive }, match: { kind, score } } ] }. " +
          "Returns an empty results array when nothing matches — not an error. " +
          "This is the preferred first step before calling create_form, update_form_sharing, search_logs, or any tool that requires a trackable_id. " +
          "Do not use this to create trackables — use create_trackable for that. " +
          "Do not call this when you already have a trackable_id — proceed directly with the tool that needs it. " +
          "Do not call this to answer general questions about how Trackables works, feature explanations, or account setup guidance — those require no tool calls.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          query: z
            .string()
            .trim()
            .max(200)
            .optional()
            .describe(
              "Optional fuzzy search text for trackable name or slug."
            ),
          kind: z
            .enum(["survey", "api_ingestion"])
            .optional()
            .describe('Optional filter: "survey" or "api_ingestion".'),
          workspace_id: z
            .string()
            .uuid("workspace_id must be a valid UUID")
            .optional()
            .describe(
              "Optional workspace UUID to restrict the search to one accessible workspace. " +
                "Defaults to the current active user workspace when omitted."
            ),
          limit: z
            .number()
            .int()
            .min(1)
            .max(25)
            .optional()
            .default(10)
            .describe("Maximum number of results to return (1-25). Default: 10."),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("find_trackables")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use find_trackables."
            )
          }

          const result = await this.trackableService.findAccessible(authContext, {
            query: args.query,
            kind: args.kind,
            workspaceId: args.workspace_id,
            limit: args.limit,
          })

          this.auditService.record({
            userId: authContext.userId,
            workspaceId: args.workspace_id,
            tool: "find_trackables",
            success: true,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString(),
          })

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          this.auditService.record({
            userId: authContext.userId,
            workspaceId: args.workspace_id,
            tool: "find_trackables",
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
