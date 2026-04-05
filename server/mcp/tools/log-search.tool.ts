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
import { mcpLogService } from "@/server/mcp/services/mcp-log.service"
import type { McpTool } from "@/server/mcp/tools/base-tool"

/**
 * search_logs Tool
 *
 * Searches API ingestion log events for a specified trackable using LiqE query syntax.
 * Returns paginated summary rows with payload previews and UI deep links.
 *
 * Only works on trackables of kind "api_ingestion".
 * Use `get_log` to retrieve a single event in full detail.
 */
export class LogSearchTool implements McpTool {
  readonly name = "search_logs" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "search_logs",
      {
        description:
          "Use this when you need to find or filter API ingestion log events for an api_ingestion-kind trackable. " +
          'Supports LiqE query syntax (e.g. `level:error`, `message:"timeout"`, `status:500`). ' +
          "Returns: { trackableId, events: [ { id, occurredAt, payloadPreview, apiKeyId, uiLink } ], hasMore, nextCursor, totalMatched }. " +
          "When hasMore is true, pass nextCursor to the next call to retrieve the following page. " +
          "Returns an empty events array when no events match — not an error. " +
          "Returns paginated summaries with payload previews — use get_log to fetch a single event in full detail. " +
          "Do not use this on survey trackables — it only works on api_ingestion-kind trackables.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          trackable_id: z
            .string()
            .uuid("trackable_id must be a valid UUID")
            .describe(
              "UUID of the api_ingestion trackable to search logs for."
            ),
          query: z
            .string()
            .trim()
            .max(500)
            .optional()
            .default("")
            .describe(
              "LiqE query string to filter log events. " +
                'Examples: `level:error`, `message:"connection refused"`, `status:500`. ' +
                "Leave empty to return all recent events."
            ),
          group_by: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .optional()
            .describe(
              "Optional payload field to group matching log events by. " +
                "Examples: `event`, `route`, `status`."
            ),
          from: z
            .string()
            .datetime()
            .optional()
            .describe(
              "ISO 8601 datetime: include only events at or after this time."
            ),
          to: z
            .string()
            .datetime()
            .optional()
            .describe(
              "ISO 8601 datetime: include only events at or before this time."
            ),
          page_size: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(25)
            .describe("Number of results per page (1–100). Default: 25."),
          cursor: z
            .string()
            .optional()
            .describe(
              "Pagination cursor from a previous search_logs response. " +
                "Pass this to retrieve the next page of results."
            ),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("search_logs")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use search_logs."
            )
          }

          const result = await mcpLogService.searchLogs(
            args.trackable_id,
            authContext,
            {
              query: args.query,
              groupBy: args.group_by,
              from: args.from,
              to: args.to,
              pageSize: args.page_size,
              cursor: args.cursor,
            }
          )

          mcpAuditService.record({
            userId: authContext.userId,
            tool: "search_logs",
            targetResourceId: args.trackable_id,
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
          mcpAuditService.record({
            userId: authContext.userId,
            tool: "search_logs",
            targetResourceId: args.trackable_id,
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
