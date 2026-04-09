import "server-only"

import { getAuth } from "@/server/get-auth"
import { TRPCError } from "@trpc/server"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getLogger } from "@/lib/logger"
import { getRuntimeConfig } from "@/lib/runtime-config"
import { resolveTierFromVariantId } from "@/lib/subscription-plans"
import { LemonSqueezySyncService } from "@/server/subscriptions/lemon-squeezy-sync.service"
import { workspaceSubscriptionRepository } from "@/server/subscriptions/subscription.repository"
import { accessControlService } from "@/server/services/access-control.service"

const logger = getLogger("billing-checkout")
const syncService = new LemonSqueezySyncService(workspaceSubscriptionRepository)

const checkoutBodySchema = z.object({
  variantId: z.string().min(1),
  workspaceId: z.string().min(1),
})

interface LemonSqueezyCheckoutResponse {
  data?: {
    attributes?: {
      url?: string
    }
  }
}

function mapTRPCErrorToStatus(error: TRPCError): number {
  switch (error.code) {
    case "UNAUTHORIZED":
      return 401
    case "FORBIDDEN":
      return 403
    case "NOT_FOUND":
      return 404
    case "BAD_REQUEST":
      return 400
    default:
      return 500
  }
}

async function switchSubscriptionPlan(
  subscriptionId: string,
  variantId: string,
  apiKey: string
): Promise<void> {
  const response = await fetch(
    `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "subscriptions",
          id: String(subscriptionId),
          attributes: {
            variant_id: parseInt(variantId, 10),
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    logger.error(
      { status: response.status, body: text },
      "LemonSqueezy subscription update failed."
    )
    throw new Error(`LemonSqueezy PATCH failed with status ${response.status}`)
  }
}

export async function POST(request: Request) {
  const { userId } = await getAuth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  const parsed = checkoutBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid variantId or workspaceId." },
      { status: 400 }
    )
  }

  const { variantId, workspaceId } = parsed.data

  try {
    await accessControlService.assertWorkspaceManagementAccess(
      userId,
      workspaceId
    )
  } catch (error) {
    if (error instanceof TRPCError) {
      return NextResponse.json(
        { error: error.message },
        { status: mapTRPCErrorToStatus(error) }
      )
    }
    throw error
  }

  const runtimeConfig = getRuntimeConfig()
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY
  const storeId = runtimeConfig.billing.lemonSqueezyStoreId

  if (!runtimeConfig.features.workspaceBillingEnabled) {
    return NextResponse.json({ error: "Billing is disabled." }, { status: 404 })
  }

  if (!apiKey || !storeId) {
    logger.error(
      { hasApiKey: !!apiKey, hasStoreId: !!storeId },
      "LemonSqueezy env vars not configured."
    )
    return NextResponse.json(
      { error: "Billing is not configured." },
      { status: 500 }
    )
  }

  // If the workspace already has an active subscription, switch the plan
  // directly via the subscriptions API rather than creating a new checkout.
  const existingSubscription =
    await workspaceSubscriptionRepository.findByWorkspaceId(workspaceId)

  if (
    existingSubscription?.lemonSqueezySubscriptionId &&
    (existingSubscription.status === "active" ||
      existingSubscription.status === "paused")
  ) {
    try {
      await switchSubscriptionPlan(
        existingSubscription.lemonSqueezySubscriptionId,
        variantId,
        apiKey
      )
      // Sync immediately so the UI reflects the new tier without waiting for
      // the webhook.
      await syncService.sync({
        workspaceId,
        subscriptionId: existingSubscription.lemonSqueezySubscriptionId,
      })
      return NextResponse.json({ switched: true })
    } catch (error) {
      logger.error({ err: error }, "Failed to switch subscription plan.")
      return NextResponse.json(
        { error: "Failed to switch plan. Please try again." },
        { status: 502 }
      )
    }
  }

  // No active subscription — create a new checkout session.
  const origin = new URL(request.url).origin
  const tier = resolveTierFromVariantId(variantId)
  const redirectUrl = `${origin}/dashboard?billing=success${tier ? `&plan=${tier}` : ""}`

  try {
    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            product_options: {
              redirect_url: redirectUrl,
            },
            checkout_data: {
              custom: {
                workspace_id: workspaceId,
              },
            },
          },
          relationships: {
            store: {
              data: { type: "stores", id: String(storeId) },
            },
            variant: {
              data: { type: "variants", id: String(variantId) },
            },
          },
        },
      }),
    })

    if (!response.ok) {
      logger.error(
        { status: response.status },
        "LemonSqueezy checkout API request failed."
      )
      return NextResponse.json(
        { error: "Failed to create checkout session." },
        { status: 502 }
      )
    }

    const payload = (await response.json()) as LemonSqueezyCheckoutResponse
    const checkoutUrl = payload.data?.attributes?.url

    if (!checkoutUrl) {
      logger.error({ payload }, "LemonSqueezy response missing checkout URL.")
      return NextResponse.json(
        { error: "Failed to create checkout session." },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    logger.error({ err: error }, "Unexpected error calling LemonSqueezy API.")
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    )
  }
}
