import { verifyWebhook } from "@clerk/backend/webhooks"
import type { WebhookEvent } from "@clerk/backend/webhooks"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { ensureUserProvisioned } from "@/server/user-provisioning"

async function upsertUser(userId: string) {
  await ensureUserProvisioned(userId)
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
        await upsertUser(event.data.id)
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
