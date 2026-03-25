import "server-only"
import { TRPCError } from "@trpc/server"
import { and, eq, inArray, isNull } from "drizzle-orm"

import { db } from "@/db"
import {
  trackableAccessGrants,
  trackableItems,
  workspaceMembers,
  users,
} from "@/db/schema"
import { userActiveWorkspaceCache, userMembershipsCache } from "@/server/redis/access-control-cache.repository"

export type AccessRole = "submit" | "view" | "manage"
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer"

export class AccessControlService {
  private getAllowedRoles(minimumRole: AccessRole) {
    if (minimumRole === "submit") {
      return ["submit", "view", "manage"] as const
    }

    if (minimumRole === "view") {
      return ["view", "manage"] as const
    }

    return ["manage"] as const
  }

  private canManageWorkspace(role: WorkspaceRole) {
    return role === "owner" || role === "admin"
  }

  private canManageTrackable(role: WorkspaceRole) {
    return role === "owner" || role === "admin" || role === "member"
  }

  private canViewTrackable(role: WorkspaceRole) {
    return role === "owner" || role === "admin" || role === "member" || role === "viewer"
  }

  async assertProjectAccess(
    projectId: string,
    userId: string,
    minimumRole: AccessRole
  ) {
    const project = await db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, projectId),
      columns: {
        id: true,
        kind: true,
        workspaceId: true,
      },
    })

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    const memberships = await userMembershipsCache.get(userId) || []
    const workspaceMembership = memberships.find(m => m.workspaceId === project.workspaceId)

    if (workspaceMembership) {
      let hasWorkspaceAccess = false
      if (minimumRole === "manage" && this.canManageTrackable(workspaceMembership.role)) {
         hasWorkspaceAccess = true
      } else if ((minimumRole === "view" || minimumRole === "submit") && this.canViewTrackable(workspaceMembership.role)) {
         hasWorkspaceAccess = true
      }

      if (hasWorkspaceAccess) {
        return project
      }
    }

    const grant = await db.query.trackableAccessGrants.findFirst({
      where: and(
        eq(trackableAccessGrants.trackableId, projectId),
        eq(trackableAccessGrants.subjectUserId, userId),
        inArray(trackableAccessGrants.role, this.getAllowedRoles(minimumRole)),
        isNull(trackableAccessGrants.revokedAt)
      ),
      columns: {
        id: true,
      },
    })

    if (!grant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    return project
  }

  async getAccessibleProjectIds(userId: string, minimumRole: AccessRole = "view") {
    const validWorkspaceRoles = minimumRole === "manage" 
      ? ["owner", "admin", "member"] as const
      : ["owner", "admin", "member", "viewer"] as const

    const [workspaceProjectRows, grantedProjects] = await Promise.all([
      db
        .select({
          id: trackableItems.id,
        })
        .from(trackableItems)
        .innerJoin(
          workspaceMembers,
          and(
            eq(workspaceMembers.workspaceId, trackableItems.workspaceId),
            eq(workspaceMembers.userId, userId),
            inArray(workspaceMembers.role, validWorkspaceRoles),
            isNull(workspaceMembers.revokedAt)
          )
        ),
      db.query.trackableAccessGrants.findMany({
        where: and(
          eq(trackableAccessGrants.subjectUserId, userId),
          inArray(trackableAccessGrants.role, this.getAllowedRoles(minimumRole)),
          isNull(trackableAccessGrants.revokedAt)
        ),
        columns: {
          trackableId: true,
        },
      }),
    ])

    return Array.from(
      new Set([
        ...workspaceProjectRows.map((project) => project.id),
        ...grantedProjects.map((grant) => grant.trackableId),
      ])
    )
  }

  async resolveActiveWorkspace(userId: string) {
    const activeWorkspaceId = await userActiveWorkspaceCache.get(userId)

    const memberships = await userMembershipsCache.get(userId) || []

    const activeMembership =
      memberships.find(
        (membership) => membership.workspaceId === activeWorkspaceId
      ) ?? memberships[0]

    if (!activeMembership) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No workspace found for this account.",
      })
    }

    if (activeMembership.workspaceId !== activeWorkspaceId) {
      await db
        .update(users)
        .set({
          activeWorkspaceId: activeMembership.workspaceId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        
      await userActiveWorkspaceCache.set(userId, activeMembership.workspaceId)
    }

    return activeMembership
  }

  async assertWorkspaceAccess(userId: string, workspaceId: string) {
    const memberships = await userMembershipsCache.get(userId) || []
    const membership = memberships.find((m) => m.workspaceId === workspaceId)

    if (!membership) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace not found.",
      })
    }

    return membership
  }

  async assertWorkspaceManagementAccess(userId: string, workspaceId: string) {
    const membership = await this.assertWorkspaceAccess(userId, workspaceId)

    if (!this.canManageWorkspace(membership.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to manage this workspace.",
      })
    }

    return membership
  }
}

export const accessControlService = new AccessControlService()
