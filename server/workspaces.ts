import "server-only"

import { TRPCError } from "@trpc/server"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { users, workspaceMembers, workspaces } from "@/db/schema"
import {
  userActiveWorkspaceCache,
  userMembershipsCache,
} from "@/server/redis/access-control-cache.repository"
import { subscriptionService } from "@/server/subscriptions/subscription-service.singleton"
import { applyWorkspaceCreationSideEffects } from "@/server/workspace-creation-side-effects"


export function buildDefaultWorkspaceName(
  _displayName: string | null,
  _email: string
) {
  return "Default workspace"
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

export function generateWorkspaceSlug(name: string, userId: string) {
  const base = slugify(name) || "workspace"
  const suffix =
    userId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(-6) || "home"
  return `${base}-${suffix}`
}

export async function createWorkspaceForUser(input: {
  userId: string
  name: string
  setActive?: boolean
}) {
  const name = input.name.trim()

  if (!name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Workspace name is required.",
    })
  }

  const slug = generateWorkspaceSlug(
    name,
    `${input.userId}-${crypto.randomUUID().slice(0, 8)}`
  )

  const result = await db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name,
        slug,
        createdByUserId: input.userId,
      })
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
      })

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: input.userId,
      role: "owner",
      createdByUserId: input.userId,
    })

    if (input.setActive ?? true) {
      await tx
        .update(users)
        .set({
          activeWorkspaceId: workspace.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId))
    }

    return workspace
  })

  await applyWorkspaceCreationSideEffects({
    workspaceId: result.id,
    userId: input.userId,
    setActive: input.setActive ?? true,
  }, {
    ensureFreeWorkspaceSubscription: (workspaceId) =>
      subscriptionService.ensureFreeWorkspaceSubscription(workspaceId),
    clearMembershipsCache: (userId) => userMembershipsCache.delete(userId),
    clearActiveWorkspaceCache: (userId) => userActiveWorkspaceCache.delete(userId),
  })

  return result
}

export async function getWorkspaceMemberships(userId: string) {
  return db.query.workspaceMembers.findMany({
    where: and(
      eq(workspaceMembers.userId, userId),
      isNull(workspaceMembers.revokedAt)
    ),
    with: {
      workspace: true,
    },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  })
}

export async function createDefaultWorkspaceForUser(input: {
  userId: string
  primaryEmail: string
  displayName: string | null
}) {
  const name = buildDefaultWorkspaceName(input.displayName, input.primaryEmail)
  const slug = generateWorkspaceSlug(name, input.userId)

  const activeWorkspaceId = await userActiveWorkspaceCache.get(input.userId)

  const existingMemberships = await getWorkspaceMemberships(input.userId)

  if (existingMemberships.length > 0) {
    const defaultWorkspaceId =
      existingMemberships.find(
        (membership) => membership.workspaceId === activeWorkspaceId
      )?.workspaceId ?? existingMemberships[0]!.workspaceId

    if (defaultWorkspaceId !== activeWorkspaceId) {
      await db
        .update(users)
        .set({
          activeWorkspaceId: defaultWorkspaceId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId))
        
      await userActiveWorkspaceCache.delete(input.userId)
    }

    return defaultWorkspaceId
  }

  const workspace = await createWorkspaceForUser({
    userId: input.userId,
    name,
  })

  return workspace.id
}
