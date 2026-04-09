import "server-only"

import { TRPCError } from "@trpc/server"
import { and, count, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { users, workspaceMembers, workspaces } from "@/db/schema"
import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement"
import { getFreeTierCreatedWorkspaceLimit } from "@/lib/subscription-plans"
import {
  userActiveWorkspaceCache,
  userMembershipsCache,
} from "@/server/redis/access-control-cache.repository"
import { subscriptionService } from "@/server/subscriptions/subscription-service.singleton"
import { applyWorkspaceCreationSideEffects } from "@/server/workspace-creation-side-effects"
import { assertCanCreateWorkspaceWithCount } from "@/server/workspace-creation-limit"

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

export async function getCreatedWorkspaceCount(userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(workspaces)
    .where(eq(workspaces.createdByUserId, userId))

  return Number(result?.count) || 0
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
    if (isSubscriptionEnforcementEnabled()) {
      const [createdWorkspaceResult] = await tx
        .select({ count: count() })
        .from(workspaces)
        .where(eq(workspaces.createdByUserId, input.userId))

      assertCanCreateWorkspaceWithCount(
        Number(createdWorkspaceResult?.count) || 0,
        getFreeTierCreatedWorkspaceLimit()
      )
    }

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

  await applyWorkspaceCreationSideEffects(
    {
      workspaceId: result.id,
      userId: input.userId,
      setActive: input.setActive ?? true,
    },
    {
      ensureWorkspaceSubscription: (workspaceId) =>
        subscriptionService.ensureWorkspaceSubscription(workspaceId),
      clearMembershipsCache: (userId) => userMembershipsCache.delete(userId),
      clearActiveWorkspaceCache: (userId) =>
        userActiveWorkspaceCache.delete(userId),
    }
  )

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
  const activeWorkspaceId = await userActiveWorkspaceCache.get(input.userId)
  const existingMemberships = await getWorkspaceMemberships(input.userId)

  if (existingMemberships.length > 0) {
    const workspaceId =
      existingMemberships.find(
        (membership) => membership.workspaceId === activeWorkspaceId
      )?.workspaceId ?? existingMemberships[0]!.workspaceId

    if (workspaceId !== activeWorkspaceId) {
      await db
        .update(users)
        .set({
          activeWorkspaceId: workspaceId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId))

      await userActiveWorkspaceCache.delete(input.userId)
    }

    return workspaceId
  }

  const workspace = await createWorkspaceForUser({
    userId: input.userId,
    name,
    setActive: true,
  })

  return workspace.id
}
