import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { user as authUsers } from "@/db/schema/auth"
import { createDefaultWorkspaceForUser } from "@/server/workspaces"

export interface ProvisioningAuthUser {
  id: string
  email: string | null | undefined
  name?: string | null
  image?: string | null
}

function assertProvisionableAuthUser(
  authUser: ProvisioningAuthUser | undefined | null,
  userId?: string
): asserts authUser is ProvisioningAuthUser & { email: string } {
  if (!authUser?.email) {
    throw new Error(
      `better-auth user ${userId ?? authUser?.id ?? "unknown"} not found or missing email`
    )
  }
}

export async function upsertAppUserFromAuthUser(
  authUser: ProvisioningAuthUser & { email: string }
) {
  await db
    .insert(users)
    .values({
      id: authUser.id,
      primaryEmail: authUser.email,
      displayName: authUser.name ?? null,
      imageUrl: authUser.image ?? null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        primaryEmail: authUser.email,
        displayName: authUser.name ?? null,
        imageUrl: authUser.image ?? null,
        updatedAt: new Date(),
      },
    })
}

export async function syncAuthUserProfile(
  authUser: ProvisioningAuthUser | undefined | null
) {
  assertProvisionableAuthUser(authUser)
  await upsertAppUserFromAuthUser(authUser)
}

export async function provisionNewAuthUser(
  authUser: ProvisioningAuthUser | undefined | null
) {
  assertProvisionableAuthUser(authUser)

  await upsertAppUserFromAuthUser(authUser)

  await createDefaultWorkspaceForUser({
    userId: authUser.id,
    primaryEmail: authUser.email,
    displayName: authUser.name ?? null,
  })
}

async function getAuthUser(userId: string) {
  return db.query.user.findFirst({
    where: eq(authUsers.id, userId),
  })
}

export async function ensureUserProvisioned(userId: string) {
  const authUser = await getAuthUser(userId)

  assertProvisionableAuthUser(authUser, userId)

  await syncAuthUserProfile(authUser)
}
