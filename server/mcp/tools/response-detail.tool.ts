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
 * get_response Tool
 *
 * Retrieves a single form submission in full structured detail.
 * The response includes the form structure at submission time and every
 * field answer, making it suitable for LLM sentiment and theme analysis.
 *
 * Use `list_responses` to discover response IDs before calling this tool.
 */
export class ResponseDetailTool implements McpTool {
  readonly name = "get_response" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "get_response",
      {
        description:
          "Use this when you need all field answers for a single form submission, for example to summarize, analyze sentiment, or extract themes. " +
          "Returns: { id, submittedAt, source, formSnapshot: { title, fields }, answers: [ { fieldKey, fieldLabel, kind, value } ] }. " +
          "The form snapshot captures the form structure at submission time, so field labels are always accurate even if the form has changed since. " +
          "Use list_responses first to discover valid response_id values — do not guess IDs. " +
          "Do not use this to list multiple responses — use list_responses for that. " +
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
            .describe("UUID of the survey trackable that owns this response."),
          response_id: z
            .string()
            .uuid("response_id must be a valid UUID")
            .describe("UUID of the specific response to retrieve."),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("get_response")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use get_response."
            )
          }

          const detail = await mcpResponseService.getResponseDetail(
            args.trackable_id,
            args.response_id,
            authContext
          )

          mcpAuditService.record({
            userId: authContext.userId,
            tool: "get_response",
            targetResourceId: args.response_id,
            success: true,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString(),
          })

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(detail, null, 2),
              },
            ],
          }
        } catch (error) {
          mcpAuditService.record({
            userId: authContext.userId,
            tool: "get_response",
            targetResourceId: args.response_id,
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
