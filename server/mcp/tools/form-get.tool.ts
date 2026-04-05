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
import { mcpFormService } from "@/server/mcp/services/mcp-form.service"
import type { McpTool } from "@/server/mcp/tools/base-tool"

/**
 * get_form Tool
 *
 * Returns the current active form definition for a survey trackable,
 * including all field configs sorted by position.
 *
 * Returns hasForm=false when the trackable exists but has no form yet,
 * so agents can branch on that state without treating it as an error.
 */
export class FormGetTool implements McpTool {
  readonly name = "get_form" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "get_form",
      {
        description:
          "Use this when you need to read the current form definition on a survey-kind trackable — for example, to see what fields exist before deciding whether to call create_form. " +
          "Returns when a form exists: { hasForm: true, formId, trackableId, version, title, description, status, submitLabel, successMessage, fieldCount, fields: [...], uiLink }. " +
          "Returns when no form is attached: { hasForm: false, trackableId, message } — this is a valid state, not an error; call create_form to add one. " +
          "Do not use this on api_ingestion trackables — it only works on survey-kind trackables. " +
          "Do not use this to modify or create a form — use create_form for that. " +
          "Do not call this just to check sharing state — use update_form_sharing to read and update sharing together.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          trackable_id: z
            .string()
            .uuid("trackable_id must be a valid UUID")
            .describe("UUID of the survey trackable to read the form from."),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("get_form")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use get_form."
            )
          }

          const result = await mcpFormService.getForm(
            args.trackable_id,
            authContext
          )

          mcpAuditService.record({
            userId: authContext.userId,
            tool: "get_form",
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
            tool: "get_form",
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
