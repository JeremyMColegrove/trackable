/**
 * MCP Auth Context
 *
 * Defines the normalized auth context that is passed to every MCP tool handler.
 * Raw tokens are never passed into business logic — only this resolved context.
 */

import type { McpToolName as SharedMcpToolName } from "@/lib/mcp-tools"

/** The set of tool names exposed through MCP. */
export type McpToolName = SharedMcpToolName

/**
 * The resolved, normalized auth context for an MCP request.
 *
 * Tool handlers receive this object.
 * All access decisions are made through this interface.
 */
export interface McpAuthContext {
  readonly userId: string
  readonly scopes: readonly string[]

  /** Returns true if the token is allowed to invoke the given tool. */
  canUseTool(tool: McpToolName): boolean

  /** Returns true if the token is allowed to access the given workspace. */
  canAccessWorkspace(workspaceId: string): boolean

  /**
   * Returns true if the token's capability scope includes the given trackable.
   */
  canAccessTrackable(trackableId: string): boolean
}

/** Concrete implementation of McpAuthContext built from standard Clerk Context. */
export class McpAuthContextImpl implements McpAuthContext {
  readonly userId: string
  readonly scopes: readonly string[]

  constructor(params: { userId: string; scopes: readonly string[] }) {
    this.userId = params.userId
    this.scopes = params.scopes
  }

  canUseTool(tool: McpToolName): boolean {
    // Current behavior: Clerk doesn't support custom scopes yet, so we allow
    // all tools natively inside the MCP server. Permissions are enforced by the API
    // data layers dynamically based on userId.
    return true
  }

  canAccessWorkspace(workspaceId: string): boolean {
    // Current behavior: Workspace access relies on data-layer access validations.
    // The oauth context operates on behalf of the user entirely.
    return true
  }

  canAccessTrackable(trackableId: string): boolean {
    // Current behavior: Trackable access relies on data-layer access validations.
    return true
  }
}
