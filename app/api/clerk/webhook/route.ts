import { verifyWebhook } from "@clerk/backend/webhooks"
import type { WebhookEvent } from "@clerk/backend/webhooks"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { createDefaultWorkspaceForUser } from "@/server/workspaces"

type ClerkUser = Extract<
  WebhookEvent,
  { type: "user.created" | "user.updated" }
>["data"]

function getPrimaryEmail(user: ClerkUser) {
  if (user.primary_email_address_id) {
    const primaryEmail = user.email_addresses.find(
      (emailAddress) => emailAddress.id === user.primary_email_address_id
    )

    if (primaryEmail) {
      return primaryEmail.email_address
    }
  }

  return user.email_addresses[0]?.email_address ?? null
}

function getDisplayName(user: ClerkUser) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ")

  return fullName || user.username || null
}

function getIsProfilePrivate(user: ClerkUser) {
  return user.public_metadata?.isProfilePrivate === true
}

async function upsertUser(user: ClerkUser) {
  const primaryEmail = getPrimaryEmail(user)

  if (!primaryEmail) {
    throw new Error(`Clerk user ${user.id} is missing a primary email address`)
  }

  await db
    .insert(users)
    .values({
      id: user.id,
      primaryEmail,
      displayName: getDisplayName(user),
      imageUrl: user.image_url,
      isProfilePrivate: getIsProfilePrivate(user),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        primaryEmail,
        displayName: getDisplayName(user),
        imageUrl: user.image_url,
        isProfilePrivate: getIsProfilePrivate(user),
        updatedAt: new Date(),
      },
    })

  await createDefaultWorkspaceForUser({
    userId: user.id,
    primaryEmail,
    displayName: getDisplayName(user),
  })
}

async function deleteUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId))
}

export async function POST(request: Request) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET

  if (!signingSecret) {
    console.error("Missing CLERK_WEBHOOK_SIGNING_SECRET")

    return Response.json(
      { error: "Webhook signing secret is not configured." },
      { status: 500 }
    )
  }

  let event: WebhookEvent

  try {
    event = await verifyWebhook(request, { signingSecret })
  } catch (error) {
    console.error("Failed to verify Clerk webhook", error)

    return Response.json(
      { error: "Webhook signature verification failed." },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await upsertUser(event.data)
        break
      case "user.deleted":
        if (event.data.id) {
          await deleteUser(event.data.id)
        }
        break
      default:
        break
    }
  } catch (error) {
    console.error("Failed to process Clerk webhook", error)

    return Response.json(
      { error: "Failed to process webhook event." },
      { status: 500 }
    )
  }

  return Response.json({ ok: true })
}
