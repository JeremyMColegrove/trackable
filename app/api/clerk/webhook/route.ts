import { verifyWebhook } from "@clerk/backend/webhooks"
import type { WebhookEvent } from "@clerk/backend/webhooks"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { getLogger } from "@/lib/logger"
import { ensureUserProvisioned } from "@/server/user-provisioning"

const logger = getLogger("clerk-webhook")

async function upsertUser(userId: string) {
  await ensureUserProvisioned(userId)
}

async function deleteUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId))
}

export async function POST(request: Request) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET

  if (!signingSecret) {
    logger.error(
      { flag: "CLERK_WEBHOOK_SIGNING_SECRET" },
      "Missing Clerk webhook signing secret."
    )

    return Response.json(
      { error: "Webhook signing secret is not configured." },
      { status: 500 }
    )
  }

  let event: WebhookEvent

  try {
    event = await verifyWebhook(request, { signingSecret })
  } catch (error) {
    logger.error({ err: error }, "Failed to verify Clerk webhook signature.")

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
        logger.info(
          { eventType: event.type, userId: event.data.id },
          "Processed Clerk user webhook."
        )
        break
      case "user.deleted":
        if (event.data.id) {
          await deleteUser(event.data.id)
          logger.info(
            { eventType: event.type, userId: event.data.id },
            "Processed Clerk user deletion webhook."
          )
        }
        break
      default:
        logger.warn({ eventType: event.type }, "Ignoring unsupported Clerk webhook event.")
        break
    }
  } catch (error) {
    logger.error(
      {
        err: error,
        eventType: event.type,
        userId: "id" in event.data ? event.data.id : null,
      },
      "Failed to process Clerk webhook."
    )

    return Response.json(
      { error: "Failed to process webhook event." },
      { status: 500 }
    )
  }

  return Response.json({ ok: true })
}
