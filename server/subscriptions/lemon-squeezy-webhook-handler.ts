import { getBoundedLogExcerpt, getLogger } from "@/lib/logger"
import type { LemonSqueezySyncService } from "@/server/subscriptions/lemon-squeezy-sync.service"

interface WebhookPayload {
  meta?: {
    event_name?: string
    custom_data?: {
      workspace_id?: string
    }
  }
  data?: {
    id?: string
  }
}

export interface LemonSqueezyWebhookHandlerInput {
  rawBody: string
  signature: string
}

interface LemonSqueezyWebhookHandlerDependencies {
  subscriptionsEnabled: () => boolean
  webhookSecret: () => string | null | undefined
  verifyWebhook(rawBody: string, signature: string, secret: string): boolean
  syncService: LemonSqueezySyncService
}

const SUBSCRIPTION_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_resumed",
  "subscription_payment_failed",
  "subscription_payment_recovered",
])

const logger = getLogger("lemon-squeezy-webhook")

export class LemonSqueezyWebhookHandler {
  constructor(
    private readonly dependencies: LemonSqueezyWebhookHandlerDependencies
  ) {}

  async handle(input: LemonSqueezyWebhookHandlerInput) {
    if (!this.dependencies.subscriptionsEnabled()) {
      logger.warn(
        { enabled: false, flag: "SUBSCRIPTION_ENFORCEMENT" },
        "Ignoring Lemon Squeezy webhook because subscription enforcement is disabled."
      )
      return new Response("Not Found", { status: 404 })
    }

    const webhookSecret = this.dependencies.webhookSecret()

    if (!webhookSecret) {
      logger.error(
        { flag: "LEMON_SQUEEZY_WEBHOOK_SECRET" },
        "Missing Lemon Squeezy webhook secret."
      )

      return Response.json(
        { error: "Webhook secret is not configured." },
        { status: 500 }
      )
    }

    if (
      !this.dependencies.verifyWebhook(
        input.rawBody,
        input.signature,
        webhookSecret
      )
    ) {
      logger.error("Failed to verify Lemon Squeezy webhook signature.")
      return Response.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      )
    }

    let payload: WebhookPayload

    try {
      payload = JSON.parse(input.rawBody) as WebhookPayload
    } catch {
      logger.warn("Received invalid JSON payload for Lemon Squeezy webhook.")
      return Response.json({ error: "Invalid JSON payload." }, { status: 400 })
    }

    const eventName = payload.meta?.event_name

    if (!eventName) {
      logger.warn("Received Lemon Squeezy webhook without event_name.")
      return Response.json(
        { error: "Invalid webhook payload." },
        { status: 400 }
      )
    }

    if (!SUBSCRIPTION_EVENTS.has(eventName)) {
      logger.warn({ eventName }, "Ignoring unsupported Lemon Squeezy webhook event.")
      return Response.json({ ok: true })
    }

    const subscriptionId = payload.data?.id

    if (!subscriptionId) {
      logger.warn({ eventName }, "Lemon Squeezy webhook is missing subscription id.")
      return Response.json(
        { error: "Missing subscription id." },
        { status: 400 }
      )
    }

    const workspaceId = payload.meta?.custom_data?.workspace_id

    if (!workspaceId) {
      logger.error(
        { eventName, subscriptionId },
        "Lemon Squeezy webhook missing workspace_id in custom_data"
      )

      return Response.json(
        { error: "Missing workspace_id in custom_data." },
        { status: 400 }
      )
    }

    try {
      await this.dependencies.syncService.sync({
        workspaceId,
        subscriptionId,
      })
      logger.info(
        { eventName, subscriptionId, workspaceId },
        "Processed Lemon Squeezy webhook."
      )
    } catch (error) {
      logger.error(
        {
          err: error,
          eventName,
          subscriptionId,
          workspaceId,
          errorExcerpt:
            error instanceof Error
              ? getBoundedLogExcerpt(error.message)
              : null,
        },
        "Failed to process Lemon Squeezy webhook."
      )

      return Response.json(
        { error: "Failed to process webhook event." },
        { status: 500 }
      )
    }

    return Response.json({ ok: true })
  }
}
