import { isNull } from "drizzle-orm"

import { db } from "@/db"
import { workspaceTeamMembers } from "@/db/schema"

async function getActiveTeamEdges() {
  return db.query.workspaceTeamMembers.findMany({
    where: isNull(workspaceTeamMembers.revokedAt),
    columns: {
      id: true,
      ownerId: true,
      memberUserId: true,
    },
  })
}

export async function getConnectedTeamUserIds(userId: string) {
  const edges = await getActiveTeamEdges()
  const visited = new Set<string>([userId])
  const queue = [userId]

  while (queue.length > 0) {
    const currentUserId = queue.shift()

    if (!currentUserId) {
      continue
    }

    for (const edge of edges) {
      if (edge.ownerId === currentUserId && !visited.has(edge.memberUserId)) {
        visited.add(edge.memberUserId)
        queue.push(edge.memberUserId)
      }

      if (edge.memberUserId === currentUserId && !visited.has(edge.ownerId)) {
        visited.add(edge.ownerId)
        queue.push(edge.ownerId)
      }
    }
  }

  visited.delete(userId)

  return Array.from(visited)
}

export async function getTeamUserIds(userId: string) {
  return [userId, ...(await getConnectedTeamUserIds(userId))]
}

export async function getTeamOwnerId(userId: string) {
  const teamUserIds = await getTeamUserIds(userId)

  if (teamUserIds.length === 1) {
    return userId
  }

  const edges = await getActiveTeamEdges()
  const incomingCounts = new Map(teamUserIds.map((id) => [id, 0]))

  for (const edge of edges) {
    if (
      teamUserIds.includes(edge.ownerId) &&
      teamUserIds.includes(edge.memberUserId)
    ) {
      incomingCounts.set(
        edge.memberUserId,
        (incomingCounts.get(edge.memberUserId) ?? 0) + 1
      )
    }
  }

  const ownerCandidates = teamUserIds
    .filter((id) => (incomingCounts.get(id) ?? 0) === 0)
    .sort()

  return ownerCandidates[0] ?? userId
}
