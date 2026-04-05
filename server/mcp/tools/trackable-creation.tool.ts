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

export class TrackableCreationTool implements McpTool {
  readonly name = "create_trackable" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "create_trackable",
      {
        description:
          "Use this when you need to create a brand-new trackable (either a survey form container or an API ingestion log container). " +
          "If workspace_id is omitted, defaults to the current active workspace. " +
          "Returns on success: { id, workspaceId, kind, name, slug, description, adminUrl }. " +
          "After creating a survey trackable, call create_form to add a form to it. " +
          "After creating an api_ingestion trackable, call create_api_key to generate an ingestion key. " +
          "Do not use this to add a form to an existing trackable — use create_form for that. " +
          "Do not call this without first using find_trackables to confirm a trackable with the same name does not already exist — creation will be rejected with CONFLICT if a duplicate name is found. " +
          "Error CONFLICT: a trackable with this exact name already exists in the workspace — use find_trackables to locate the existing one, or choose a different name. " +
          "Error LIMIT_REACHED: the workspace has reached its trackable quota — do not retry; inform the user to upgrade their plan or archive existing trackables first.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          workspace_id: z
            .string()
            .uuid("workspace_id must be a valid UUID")
            .optional()
            .describe(
              "Optional UUID of the workspace that should own the new trackable. " +
                "Defaults to the current active user workspace when omitted."
            ),
          kind: z
            .enum(["survey", "api_ingestion"])
            .describe('Trackable kind: "survey" or "api_ingestion".'),
          name: z
            .string()
            .trim()
            .min(2, "name must be at least 2 characters")
            .max(120, "name must be at most 120 characters")
            .describe("Human-friendly trackable name."),
          description: z
            .string()
            .max(500)
            .optional()
            .describe("Optional description for the trackable."),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("create_trackable")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use create_trackable."
            )
          }

          const trackable = await mcpTrackableService.createTrackable(
            authContext,
            {
              workspaceId: args.workspace_id,
              kind: args.kind,
              name: args.name,
              description: args.description,
            }
          )

          mcpAuditService.record({
            userId: authContext.userId,
            workspaceId: args.workspace_id,
            tool: "create_trackable",
            targetResourceId: trackable.id,
            success: true,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString(),
          })

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(trackable, null, 2),
              },
            ],
          }
        } catch (error) {
          mcpAuditService.record({
            userId: authContext.userId,
            workspaceId: args.workspace_id,
            tool: "create_trackable",
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
