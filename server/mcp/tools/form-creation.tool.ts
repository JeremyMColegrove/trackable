import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { mcpCreateFormToolInputSchema } from "@/lib/mcp-form-tool-schema"
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
 * create_form Tool
 *
 * Creates a form on an existing survey trackable from a structured JSON payload.
 * This tool only manages form definition. Sharing is handled separately by
 * the update_form_sharing tool.
 *
 * This tool behaves as a strict JSON contract:
 * - The payload is validated deterministically before any database write
 * - Validation errors include exact paths, received values, and expected types
 * - Agents can read validation errors, repair the payload, and retry
 * - Only supported field types (rating, checkboxes, notes, short_text) are accepted
 * - file_upload and youtube_video kinds are not supported via MCP
 *
 * The agent is responsible for constructing the form JSON externally.
 * No natural language interpretation occurs inside this tool.
 */
export class FormCreationTool implements McpTool {
  readonly name = "create_form" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "create_form",
      {
        description:
          "Use this when you need to create a form on an existing survey-kind trackable. " +
          "The trackable must already exist (create it first with create_trackable if needed). " +
          "Returns on success: { success: true, formId, trackableId }. " +
          "Returns on validation failure: { success: false, errorCode, errors: [{ path, issue, received, expected }] } — the call does not throw on validation errors, so always check the success field before proceeding. " +
          "The payload is validated strictly — on failure, structured errors with exact field paths are returned so you can repair and retry. " +
          "Supported field kinds: rating, checkboxes, notes, short_text. " +
          "Do not use file_upload or youtube_video kinds — they are not supported via MCP. " +
          "Do not use this to manage public sharing — use update_form_sharing for that. " +
          "Calling this on a trackable that already has a form will replace it with a new version — the previous form is archived, not deleted. Use get_form first to review the existing form before overwriting it. " +
          "REQUIRED FIELD SHAPE: every field must include key (unique snake_case id), kind, label, required (boolean), and config (must match the field kind). " +
          "CONFIG RULES: " +
          "rating → config.kind='rating', config.scale=integer 3-10; " +
          "checkboxes → config.kind='checkboxes', config.options=[{label, value}] (do NOT include id — server generates it); " +
          "notes → config.kind='notes' (optional placeholder, maxLength 1-5000); " +
          "short_text → config.kind='short_text' (optional placeholder, maxLength 1-500). " +
          'EXAMPLE PAYLOAD: { "trackable_id": "<uuid>", "form": { "title": "Customer Feedback", "status": "published", "fields": [ { "key": "rating_1", "kind": "rating", "label": "How would you rate us?", "required": true, "config": { "kind": "rating", "scale": 5 } }, { "key": "feedback_text", "kind": "notes", "label": "Additional comments", "required": false, "config": { "kind": "notes", "placeholder": "Tell us more..." } }, { "key": "topic", "kind": "checkboxes", "label": "What topics apply?", "required": false, "config": { "kind": "checkboxes", "options": [ { "label": "Support", "value": "support" }, { "label": "Billing", "value": "billing" } ] } } ] } }',
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: mcpCreateFormToolInputSchema,
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("create_form")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use create_form."
            )
          }

          // Delegate full validation and creation to the service.
          // The service runs strict Zod validation on the form payload before
          // any DB write, returning structured errors on failure.
          const result = await mcpFormService.createFormFromPayload(
            args.trackable_id,
            args.form,
            authContext
          )

          mcpAuditService.record({
            userId: authContext.userId,
            tool: "create_form",
            targetResourceId: args.trackable_id,
            success: result.success,
            errorCode: result.errorCode as McpErrorCode | undefined,
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
            tool: "create_form",
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
