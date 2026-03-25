import { logger } from "@/lib/logger"
import type { LemonSqueezySubscriptionSnapshot } from "@/server/subscriptions/lemon-squeezy"
import type {
  SubscriptionTier,
  WorkspaceSubscriptionUpsertInput,
} from "@/server/subscriptions/types"

interface WebhookPayload {
  meta?: {
    event_name: string
    custom_data?: {
      workspace_id?: string
    }
  }
  data?: {
    id?: string
  }
}

interface ProcessLemonSqueezyWebhookInput {
  rawBody: string
  signature: string
  webhookSecret: string | null | undefined
  subscriptionsEnabled?: boolean
}

interface ProcessLemonSqueezyWebhookDependencies {
  verifyWebhook(
    rawBody: string,
    signature: string,
    secret: string
  ): boolean
  fetchSubscription(subscriptionId: string): Promise<LemonSqueezySubscriptionSnapshot>
  resolveTier(variantId: string): SubscriptionTier | null
  upsertWorkspaceSubscription(
    input: WorkspaceSubscriptionUpsertInput
  ): Promise<unknown>
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

export async function processLemonSqueezyWebhook(
  input: ProcessLemonSqueezyWebhookInput,
  dependencies: ProcessLemonSqueezyWebhookDependencies
) {
  if (input.subscriptionsEnabled === false) {
    return new Response("Not Found", { status: 404 })
  }

  if (!input.webhookSecret) {
    logger.error("Missing LEMON_SQUEEZY_WEBHOOK_SECRET")

    return Response.json(
      { error: "Webhook secret is not configured." },
      { status: 500 }
    )
  }

  if (
    !dependencies.verifyWebhook(
      input.rawBody,
      input.signature,
      input.webhookSecret
    )
  ) {
    return Response.json(
      { error: "Invalid webhook signature." },
      { status: 400 }
    )
  }

  let payload: WebhookPayload

  try {
    payload = JSON.parse(input.rawBody) as WebhookPayload
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const eventName = payload.meta?.event_name
  const subscriptionId = payload.data?.id

  if (!eventName) {
    return Response.json(
      { error: "Invalid webhook payload." },
      { status: 400 }
    )
  }

  if (!SUBSCRIPTION_EVENTS.has(eventName)) {
    return Response.json({ ok: true })
  }

  if (!subscriptionId) {
    return Response.json({ error: "Missing subscription id." }, { status: 400 })
  }

  const workspaceId = payload.meta?.custom_data?.workspace_id

  if (!workspaceId) {
    logger.error(
      { eventName },
      "Lemon Squeezy webhook missing workspace_id in custom_data"
    )

    return Response.json(
      { error: "Missing workspace_id in custom_data." },
      { status: 400 }
    )
  }

  try {
    const subscription = await dependencies.fetchSubscription(subscriptionId)
    const tier = dependencies.resolveTier(subscription.variantId)

    if (!tier) {
      logger.error(
        { subscriptionId, variantId: subscription.variantId, workspaceId },
        "Unknown Lemon Squeezy variant id for workspace subscription"
      )

      return Response.json(
        { error: "Unknown Lemon Squeezy variant id." },
        { status: 500 }
      )
    }

    await dependencies.upsertWorkspaceSubscription({
      workspaceId,
      lemonSqueezySubscriptionId: subscription.lemonSqueezySubscriptionId,
      lemonSqueezyCustomerId: subscription.lemonSqueezyCustomerId,
      variantId: subscription.variantId,
      tier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    })
  } catch (error) {
    logger.error(
      { error, eventName, subscriptionId, workspaceId },
      "Failed to process Lemon Squeezy webhook"
    )

    return Response.json(
      { error: "Failed to process webhook event." },
      { status: 500 }
    )
  }

  return Response.json({ ok: true })
}
