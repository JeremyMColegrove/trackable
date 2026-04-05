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
 * get_response_stats Tool
 *
 * Returns aggregate statistics across all responses for a survey trackable
 * without requiring the caller to page through individual submissions.
 *
 * Field stats are computed from up to 500 most recent responses.
 * The response includes both totalResponses (authoritative counter) and
 * sampledResponses (rows actually read) so callers know when stats are partial.
 */
export class ResponseStatsTool implements McpTool {
  readonly name = "get_response_stats" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "get_response_stats",
      {
        description:
          "Use this when you need aggregate statistics across all responses for a survey trackable — for example, to summarize feedback, compute average ratings, or count checkbox selections. " +
          "Returns: { trackableId, totalResponses, sampledResponses, fieldStats: [ { key, kind, label, ...kindSpecificStats } ] }. " +
          "Rating fields include mean and score distribution. Checkbox fields include per-option counts. Text fields include up to 5 sample answers. " +
          "Field stats are computed from up to 500 most recent responses; sampledResponses tells you the actual count read — when sampledResponses < totalResponses the stats are a sample. " +
          "Do not use this to retrieve individual response details — use list_responses or get_response for that. " +
          "Do not use this on api_ingestion trackables — it only works on survey-kind trackables.",
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
              "UUID of the survey trackable to compute response stats for."
            ),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("get_response_stats")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use get_response_stats."
            )
          }

          const result = await mcpResponseService.getResponseStats(
            args.trackable_id,
            authContext
          )

          mcpAuditService.record({
            userId: authContext.userId,
            tool: "get_response_stats",
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
            tool: "get_response_stats",
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
