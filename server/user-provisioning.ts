import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

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

  await db
    .insert(users)
    .values({
      id: clerkUser.id,
      primaryEmail,
      displayName: getDisplayName(clerkUser),
      imageUrl: clerkUser.imageUrl,
      isProfilePrivate: getIsProfilePrivate(clerkUser),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        primaryEmail,
        displayName: getDisplayName(clerkUser),
        imageUrl: clerkUser.imageUrl,
        isProfilePrivate: getIsProfilePrivate(clerkUser),
        updatedAt: new Date(),
      },
    })

  await createDefaultWorkspaceForUser({
    userId: clerkUser.id,
    primaryEmail,
    displayName: getDisplayName(clerkUser),
  })
}
