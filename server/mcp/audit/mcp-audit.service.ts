import "server-only"

import { logger } from "@/lib/logger"
import type { McpToolName } from "@/server/mcp/auth/mcp-auth-context"
import type { McpErrorCode } from "@/server/mcp/errors/mcp-errors"

/**
 * Structured audit record for a single MCP tool invocation.
 * Captured for every request regardless of success or failure.
 */
export interface McpAuditEntry {
  userId: string
  workspaceId?: string
  tool: McpToolName | string
  /** Primary resource ID targeted by the tool, if applicable */
  targetResourceId?: string
  success: boolean
  errorCode?: McpErrorCode
  durationMs: number
  timestamp: string
}

/**
 * MCP Audit Service
 *
 * Records every MCP tool invocation as a structured log entry using pino.
 * Audit records are fire-and-forget — they do not block tool responses.
 *
 * In a future iteration this can be extended to persist records to a database
 * table for compliance querying.
 */
export class McpAuditService {
  /**
   * Records a completed tool invocation.
   * Safe to call without await — does not throw.
   */
  record(entry: McpAuditEntry): void {
    const logFields = {
      mcp: true,
      userId: entry.userId,
      workspaceId: entry.workspaceId,
      tool: entry.tool,
      targetResourceId: entry.targetResourceId,
      success: entry.success,
      errorCode: entry.errorCode,
      durationMs: entry.durationMs,
      timestamp: entry.timestamp,
    }

    if (entry.success) {
      logger.info(logFields, "MCP tool invocation succeeded")
    } else {
      logger.warn(logFields, "MCP tool invocation failed")
    }
  }
}

export const mcpAuditService = new McpAuditService()
