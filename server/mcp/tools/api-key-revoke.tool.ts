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
import { mcpApiKeyService } from "@/server/mcp/services/mcp-api-key.service"
import type { McpTool } from "@/server/mcp/tools/base-tool"

/**
 * revoke_api_key Tool
 *
 * Revokes an existing API key for an api_ingestion trackable.
 * Revocation is immediate and irreversible — the key will no longer authenticate.
 * If the key is already revoked, the operation succeeds idempotently.
 */
export class ApiKeyRevokeTool implements McpTool {
  readonly name = "revoke_api_key" as const

  register(server: McpServer, authContext: McpAuthContext): void {
    server.registerTool(
      "revoke_api_key",
      {
        description:
          "Use this when you need to permanently disable an API key so it can no longer ingest log events. " +
          "Returns: { id, status: 'revoked', revokedAt }. " +
          "Revocation is immediate and irreversible — the key cannot be restored. " +
          "If the key is already revoked, the call succeeds idempotently. " +
          "Use list_api_keys first to find the api_key_id — do not guess IDs. " +
          "Do not use this to delete a trackable or workspace — this only revokes a single API key. " +
          "Do not use this as a temporary or reversible action — revocation is permanent and cannot be undone. If the goal is key rotation, call create_api_key first, then revoke the old key.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false,
        },
        inputSchema: {
          trackable_id: z
            .string()
            .uuid("trackable_id must be a valid UUID")
            .describe("UUID of the api_ingestion trackable."),
          api_key_id: z
            .string()
            .uuid("api_key_id must be a valid UUID")
            .describe("UUID of the API key to revoke. Use list_api_keys to find key IDs."),
        },
      },
      async (args) => {
        const start = Date.now()
        try {
          if (!authContext.canUseTool("revoke_api_key")) {
            throw new McpToolError(
              "SCOPE_ERROR",
              "This token does not have permission to use revoke_api_key."
            )
          }

          const result = await mcpApiKeyService.revokeApiKey(
            args.trackable_id,
            args.api_key_id,
            authContext
          )

          mcpAuditService.record({
            userId: authContext.userId,
            tool: "revoke_api_key",
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
            tool: "revoke_api_key",
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
