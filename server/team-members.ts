import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { workspaceMembers } from "@/db/schema"
import { resolveActiveWorkspace } from "@/server/workspaces"

export async function getConnectedTeamUserIds(userId: string) {
  const activeWorkspace = await resolveActiveWorkspace(userId)
  const members = await db.query.workspaceMembers.findMany({
    where: and(
      eq(workspaceMembers.workspaceId, activeWorkspace.workspaceId),
      isNull(workspaceMembers.revokedAt)
    ),
    columns: {
      userId: true,
    },
  })

  return members.map((member) => member.userId).filter((id) => id !== userId)
}

export async function getTeamUserIds(userId: string) {
  return [userId, ...(await getConnectedTeamUserIds(userId))]
}

export async function getTeamOwnerId(userId: string) {
  const activeWorkspace = await resolveActiveWorkspace(userId)
  const owner = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, activeWorkspace.workspaceId),
      eq(workspaceMembers.role, "owner"),
      isNull(workspaceMembers.revokedAt)
    ),
    columns: {
      userId: true,
    },
  })

  return owner?.userId ?? userId
}
