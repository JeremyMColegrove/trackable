import { TRPCError } from "@trpc/server"
import { and, eq, inArray, isNull } from "drizzle-orm"

import { db } from "@/db"
import {
  trackableAccessGrants,
  trackableItems,
  workspaceMembers,
} from "@/db/schema"

type AccessRole = "submit" | "view" | "manage"

function getAllowedRoles(minimumRole: AccessRole) {
  if (minimumRole === "submit") {
    return ["submit", "view", "manage"] as const
  }

  if (minimumRole === "view") {
    return ["view", "manage"] as const
  }

  return ["manage"] as const
}

export async function assertProjectAccess(
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

  const workspaceMembership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, userId),
      isNull(workspaceMembers.revokedAt)
    ),
    columns: {
      id: true,
    },
  })

  if (workspaceMembership) {
    return project
  }

  const grant = await db.query.trackableAccessGrants.findFirst({
    where: and(
      eq(trackableAccessGrants.trackableId, projectId),
      eq(trackableAccessGrants.subjectUserId, userId),
      inArray(trackableAccessGrants.role, getAllowedRoles(minimumRole)),
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

export async function getAccessibleProjectIds(
  userId: string,
  minimumRole: AccessRole = "view"
) {
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
          isNull(workspaceMembers.revokedAt)
        )
      ),
    db.query.trackableAccessGrants.findMany({
      where: and(
        eq(trackableAccessGrants.subjectUserId, userId),
        inArray(trackableAccessGrants.role, getAllowedRoles(minimumRole)),
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
