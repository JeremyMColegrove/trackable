import { TRPCError } from "@trpc/server"
import { and, eq, inArray, isNull } from "drizzle-orm"

import { db } from "@/db"
import { trackableAccessGrants, trackableItems } from "@/db/schema"
import { getConnectedTeamUserIds } from "@/server/team-members"

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
      ownerId: true,
    },
  })

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Trackable not found.",
    })
  }

  if (project.ownerId === userId) {
    return project
  }

  const connectedTeamUserIds = await getConnectedTeamUserIds(userId)

  if (connectedTeamUserIds.includes(project.ownerId)) {
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
  const connectedTeamUserIds = await getConnectedTeamUserIds(userId)
  const ownerIds = [userId, ...connectedTeamUserIds]

  const [ownedProjects, grantedProjects] = await Promise.all([
    db.query.trackableItems.findMany({
      where: inArray(trackableItems.ownerId, ownerIds),
      columns: {
        id: true,
      },
    }),
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
      ...ownedProjects.map((project) => project.id),
      ...grantedProjects.map((grant) => grant.trackableId),
    ])
  )
}
