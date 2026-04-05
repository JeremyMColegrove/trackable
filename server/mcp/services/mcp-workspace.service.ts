import "server-only"

import { userMembershipsCache } from "@/server/redis/access-control-cache.repository"
import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import { McpToolError } from "@/server/mcp/errors/mcp-errors"
import { accessControlService } from "@/server/services/access-control.service"

export interface McpWorkspaceSummary {
  id: string
  name: string
  slug: string
  role: string
  canCreateTrackables: boolean
  isActive: boolean
}

export class McpWorkspaceService {
  async listAccessible(
    authContext: McpAuthContext
  ): Promise<McpWorkspaceSummary[]> {
    const activeWorkspace = await accessControlService.resolveActiveWorkspace(
      authContext.userId
    )
    const memberships =
      (await userMembershipsCache.get(authContext.userId)) ?? []

    return memberships
      .filter((membership) =>
        authContext.canAccessWorkspace(membership.workspaceId)
      )
      .map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
        canCreateTrackables: accessControlService.canManageTrackableRole(
          membership.role
        ),
        isActive: membership.workspace.id === activeWorkspace.workspace.id,
      }))
  }

  async assertWorkspaceAccess(
    workspaceId: string,
    authContext: McpAuthContext
  ): Promise<McpWorkspaceSummary> {
    const workspaces = await this.listAccessible(authContext)
    const workspace = workspaces.find((entry) => entry.id === workspaceId)

    if (!workspace) {
      throw new McpToolError(
        "SCOPE_ERROR",
        "This token does not have access to the requested workspace."
      )
    }

    return workspace
  }
}

export const mcpWorkspaceService = new McpWorkspaceService()
