import "server-only"

import { TRPCError } from "@trpc/server"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { users, workspaceMembers, workspaces } from "@/db/schema"

type WorkspaceRole = "owner" | "admin" | "member"

function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "admin"
}

export function buildDefaultWorkspaceName(
  displayName: string | null,
  email: string
) {
  const baseName = displayName?.trim() || email.split("@")[0] || "My"
  return `${baseName}'s Workspace`
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

export async function resolveActiveWorkspace(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      activeWorkspaceId: true,
    },
  })

  const memberships = await getWorkspaceMemberships(userId)

  const activeMembership =
    memberships.find(
      (membership) => membership.workspaceId === user?.activeWorkspaceId
    ) ?? memberships[0]

  if (!activeMembership) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No workspace found for this account.",
    })
  }

  if (activeMembership.workspaceId !== user?.activeWorkspaceId) {
    await db
      .update(users)
      .set({
        activeWorkspaceId: activeMembership.workspaceId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
  }

  return activeMembership
}

export async function assertWorkspaceAccess(
  userId: string,
  workspaceId: string
) {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.userId, userId),
      eq(workspaceMembers.workspaceId, workspaceId),
      isNull(workspaceMembers.revokedAt)
    ),
    with: {
      workspace: true,
    },
  })

  if (!membership) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Workspace not found.",
    })
  }

  return membership
}

export async function assertWorkspaceManagementAccess(
  userId: string,
  workspaceId: string
) {
  const membership = await assertWorkspaceAccess(userId, workspaceId)

  if (!canManageWorkspace(membership.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to manage this workspace.",
    })
  }

  return membership
}

export async function createDefaultWorkspaceForUser(input: {
  userId: string
  primaryEmail: string
  displayName: string | null
}) {
  const name = buildDefaultWorkspaceName(input.displayName, input.primaryEmail)
  const slug = generateWorkspaceSlug(name, input.userId)

  const existingMemberships = await getWorkspaceMemberships(input.userId)

  if (existingMemberships.length > 0) {
    return existingMemberships[0]!.workspaceId
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name,
      slug,
      createdByUserId: input.userId,
    })
    .returning({
      id: workspaces.id,
    })

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: input.userId,
    role: "owner",
    createdByUserId: input.userId,
  })

  await db
    .update(users)
    .set({
      activeWorkspaceId: workspace.id,
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId))

  return workspace.id
}
