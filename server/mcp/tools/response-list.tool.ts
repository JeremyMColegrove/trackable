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
import { mcpResponseService } from "@/server/mcp/services/mcp-response.service"
import type { McpTool } from "@/server/mcp/tools/base-tool"

/**
 * list_responses Tool
 *
 * Returns a paginated list of survey form submission summaries.
 * Each summary includes compact field values for quick analysis.
 * Use `get_response` to retrieve a full structured response for deep analysis.
 *
 * Only works on trackables of kind "survey".
 */
export class ResponseListTool implements McpTool {
  readonly name = "list_responses" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "list_responses",
      {
        description:
          "Use this when you need to browse or count form submission responses for a survey-kind trackable. " +
          "Returns: { trackableId, responses: [ { id, submittedAt, source, fieldSummaries, uiLink } ], hasMore, nextCursor }. " +
          "fieldSummaries is a compact key→value map for quick scanning. When hasMore is true, pass nextCursor to retrieve the next page. " +
          "Returns an empty array when no responses exist — not an error. " +
          "Use get_response to retrieve the full structured answer for a specific submission. " +
          "Do not use this on api_ingestion trackables — it only works on survey-kind trackables. " +
          "Do not call this when the goal is aggregate statistics such as averages or counts — use get_response_stats instead.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          trackable_id: z
            .string()
            .uuid("trackable_id must be a valid UUID")
            .describe("UUID of the survey trackable to list responses for."),
          page_size: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(25)
            .describe("Number of responses per page (1–100). Default: 25."),
          cursor: z
            .string()
            .optional()
            .describe(
              "Pagination cursor from a previous list_responses response. " +
                "Pass this to retrieve the next page."
            ),
          from: z
            .string()
            .datetime()
            .optional()
            .describe(
              "ISO 8601 datetime: include only responses submitted at or after this time."
            ),
          to: z
            .string()
            .datetime()
            .optional()
            .describe(
              "ISO 8601 datetime: include only responses submitted at or before this time."
            ),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("list_responses")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use list_responses."
            )
          }

          const result = await mcpResponseService.listResponses(
            args.trackable_id,
            authContext,
            {
              pageSize: args.page_size,
              cursor: args.cursor,
              from: args.from,
              to: args.to,
            }
          )

          mcpAuditService.record({
            userId: authContext.userId,
            tool: "list_responses",
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
            tool: "list_responses",
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
