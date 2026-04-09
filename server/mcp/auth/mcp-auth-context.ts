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
  private readonly tools: "all" | readonly McpToolName[]
  private readonly workspaceIds?: ReadonlySet<string>
  private readonly trackableIds?: ReadonlySet<string>

  constructor(params: {
    userId: string
    scopes?: readonly string[]
    tools: "all" | readonly McpToolName[]
    workspaceIds?: readonly string[]
    trackableIds?: readonly string[]
  }) {
    this.userId = params.userId
    this.scopes = params.scopes ?? []
    this.tools = params.tools
    this.workspaceIds = params.workspaceIds?.length
      ? new Set(params.workspaceIds)
      : undefined
    this.trackableIds = params.trackableIds?.length
      ? new Set(params.trackableIds)
      : undefined
  }

  canUseTool(tool: McpToolName): boolean {
    return this.tools === "all" || this.tools.includes(tool)
  }

  canAccessWorkspace(workspaceId: string): boolean {
    return !this.workspaceIds || this.workspaceIds.has(workspaceId)
  }

  canAccessTrackable(trackableId: string): boolean {
    return !this.trackableIds || this.trackableIds.has(trackableId)
  }
}
