import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import { db, withUserContext } from "@/db"
import { workspaceMembers } from "@/db/schema"
import { accessControlService } from "@/server/services/access-control.service"

export async function getConnectedTeamUserIds(userId: string) {
  const activeWorkspace =
    await accessControlService.resolveActiveWorkspace(userId)
  const members = await withUserContext(userId, (db) =>
    db.query.workspaceMembers.findMany({
      where: and(
        eq(workspaceMembers.workspaceId, activeWorkspace.workspaceId),
        isNull(workspaceMembers.revokedAt)
      ),
      columns: {
        userId: true,
      },
    })
  )

  return members.map((member) => member.userId).filter((id) => id !== userId)
}

export async function getTeamUserIds(userId: string) {
  return [userId, ...(await getConnectedTeamUserIds(userId))]
}

export async function getTeamOwnerId(userId: string) {
  const activeWorkspace =
    await accessControlService.resolveActiveWorkspace(userId)
  const owner = await withUserContext(userId, (db) =>
    db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, activeWorkspace.workspaceId),
        eq(workspaceMembers.role, "owner"),
        isNull(workspaceMembers.revokedAt)
      ),
      columns: {
        userId: true,
      },
    })
  )

  return owner?.userId ?? userId
}
