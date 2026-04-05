/**
 * Base MCP Tool
 *
 * Defines the interface every tool class must implement.
 * Tools are thin orchestrators: they check capabilities, call services,
 * record audit entries, and map results to MCP content.
 *
 * Tools never contain raw database queries or business logic.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type {
  McpAuthContext,
  McpToolName,
} from "@/server/mcp/auth/mcp-auth-context"

/** Every MCP tool class must implement this interface. */
export interface McpTool {
  readonly name: McpToolName

  /**
   * Registers this tool with the given McpServer instance.
   * The auth context is captured via closure so tool handlers
   * have access to it without receiving raw tokens.
   */
  register(server: McpServer, authContext: McpAuthContext): void
}
