import "server-only"

import { clerkClient } from "@clerk/nextjs/server"
import { eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { createDefaultWorkspaceForUser } from "@/server/workspaces"

function getPrimaryEmail(
  user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>
) {
  if (user.primaryEmailAddressId) {
    const primaryEmail = user.emailAddresses.find(
      (emailAddress) => emailAddress.id === user.primaryEmailAddressId
    )

    if (primaryEmail) {
      return primaryEmail.emailAddress
    }
  }

  return user.emailAddresses[0]?.emailAddress ?? null
}

function getDisplayName(
  user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>
) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ")

  return fullName || user.username || null
}

function getIsProfilePrivate(
  user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>
) {
  return user.publicMetadata?.isProfilePrivate === true
}

export async function ensureUserProvisioned(userId: string) {
  const clerk = await clerkClient()
  const clerkUser = await clerk.users.getUser(userId)
  const primaryEmail = getPrimaryEmail(clerkUser)

  if (!primaryEmail) {
    throw new Error(`Clerk user ${userId} is missing a primary email address`)
  }

  const displayName = getDisplayName(clerkUser)
  const isProfilePrivate = getIsProfilePrivate(clerkUser)

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(41827391)`)

    const existingUser = await tx.query.users.findFirst({
      where: eq(users.id, clerkUser.id),
      columns: {
        id: true,
        hasAdminControls: true,
      },
    })

    if (existingUser) {
      await tx
        .update(users)
        .set({
          primaryEmail,
          displayName,
          imageUrl: clerkUser.imageUrl,
          isProfilePrivate,
          updatedAt: new Date(),
        })
        .where(eq(users.id, clerkUser.id))

      return
    }

    const [{ count }] = await tx
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(users)

    await tx.insert(users).values({
      id: clerkUser.id,
      primaryEmail,
      displayName,
      imageUrl: clerkUser.imageUrl,
      hasAdminControls: count === 0,
      isProfilePrivate,
    })
  })

  await createDefaultWorkspaceForUser({
    userId: clerkUser.id,
    primaryEmail,
    displayName,
  })
}
