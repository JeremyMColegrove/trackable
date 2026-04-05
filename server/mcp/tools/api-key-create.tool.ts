import "server-only";

import { mcpAuditService } from "@/server/mcp/audit/mcp-audit.service";
import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context";
import {
	buildMcpErrorContent,
	type McpErrorCode,
	McpToolError,
} from "@/server/mcp/errors/mcp-errors";
import { mcpApiKeyService } from "@/server/mcp/services/mcp-api-key.service";
import type { McpTool } from "@/server/mcp/tools/base-tool";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * create_api_key Tool
 *
 * Creates a new API key for an api_ingestion trackable.
 * The plaintext key is returned ONCE in the response and cannot be retrieved again.
 * Only works on trackables of kind api_ingestion.
 */
export class ApiKeyCreateTool implements McpTool {
	readonly name = "create_api_key" as const;

	register(server: McpServer, authContext: McpAuthContext): void {
		server.registerTool(
			"create_api_key",
			{
				description:
					"Use this when you need to generate a new API key so a client can ingest log events into an api_ingestion-kind trackable. " +
					"Returns on success: { id, name, status, expiresAt, plaintextKey }. plaintextKey is the full secret and is returned only once — it cannot be retrieved again, so present it to the user immediately. " +
					"Do not use this on survey trackables — it only works on api_ingestion-kind trackables. " +
					"Do not use this to list or revoke existing keys — use list_api_keys or revoke_api_key for those. ",
				annotations: {
					readOnlyHint: false,
					destructiveHint: false,
					openWorldHint: false,
				},
				inputSchema: {
					trackable_id: z
						.string()
						.uuid("trackable_id must be a valid UUID")
						.describe("UUID of the api_ingestion trackable."),
					name: z
						.string()
						.trim()
						.min(1)
						.max(100)
						.describe("Human-readable label for this API key."),
					expiration: z
						.enum(["never", "30_days", "60_days", "90_days"])
						.optional()
						.default("never")
						.describe(
							"When the key should expire. One of: never, 30_days, 60_days, 90_days. Default: never.",
						),
				},
			},
			async (args) => {
				const start = Date.now();
				try {
					if (!authContext.canUseTool("create_api_key")) {
						throw new McpToolError(
							"SCOPE_ERROR",
							"This token does not have permission to use create_api_key.",
						);
					}

					const result = await mcpApiKeyService.createApiKey(
						args.trackable_id,
						{
							name: args.name,
							expirationPreset: args.expiration,
						},
						authContext,
					);

					mcpAuditService.record({
						userId: authContext.userId,
						tool: "create_api_key",
						targetResourceId: args.trackable_id,
						success: true,
						durationMs: Date.now() - start,
						timestamp: new Date().toISOString(),
					});

					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify(result, null, 2),
							},
						],
					};
				} catch (error) {
					mcpAuditService.record({
						userId: authContext.userId,
						tool: "create_api_key",
						targetResourceId: args.trackable_id,
						success: false,
						errorCode: (error as { code?: McpErrorCode }).code,
						durationMs: Date.now() - start,
						timestamp: new Date().toISOString(),
					});

					return {
						content: [
							{ type: "text" as const, text: buildMcpErrorContent(error) },
						],
					};
				}
			},
		);
	}
}
