import "server-only"

import { getAuth } from "@/server/get-auth"
import { TRPCError } from "@trpc/server"
import { NextResponse } from "next/server"

import { getLogger } from "@/lib/logger"
import { getRuntimeConfig } from "@/lib/runtime-config"
import { workspaceSubscriptionRepository } from "@/server/subscriptions/subscription.repository"
import { accessControlService } from "@/server/services/access-control.service"

const logger = getLogger("billing-portal")

interface LemonSqueezyCustomerResponse {
  data?: {
    attributes?: {
      urls?: {
        customer_portal?: string | null
      }
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

export async function GET(request: Request) {
  const { userId } = await getAuth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get("workspaceId")

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Missing workspaceId." },
      { status: 400 }
    )
  }

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
  const fallbackUrl = runtimeConfig.billing.manageUrl

  const subscription =
    await workspaceSubscriptionRepository.findByWorkspaceId(workspaceId)

  const customerId = subscription?.lemonSqueezyCustomerId
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY

  if (!customerId || !apiKey) {
    if (!fallbackUrl) {
      return NextResponse.json(
        { error: "Billing portal is not configured." },
        { status: 404 }
      )
    }
    return NextResponse.json({ url: fallbackUrl })
  }

  try {
    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/customers/${customerId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      logger.warn(
        { status: response.status, customerId },
        "Lemon Squeezy customer portal fetch failed, falling back."
      )
      if (!fallbackUrl) {
        return NextResponse.json(
          { error: "Failed to retrieve billing portal URL." },
          { status: 502 }
        )
      }
      return NextResponse.json({ url: fallbackUrl })
    }

    const payload = (await response.json()) as LemonSqueezyCustomerResponse
    const portalUrl = payload.data?.attributes?.urls?.customer_portal

    if (!portalUrl) {
      logger.warn(
        { customerId },
        "Lemon Squeezy customer portal URL missing in response, falling back."
      )
      if (!fallbackUrl) {
        return NextResponse.json(
          { error: "Failed to retrieve billing portal URL." },
          { status: 502 }
        )
      }
      return NextResponse.json({ url: fallbackUrl })
    }

    return NextResponse.json({ url: portalUrl })
  } catch (error) {
    logger.error({ err: error }, "Unexpected error fetching customer portal URL.")
    if (!fallbackUrl) {
      return NextResponse.json(
        { error: "Failed to retrieve billing portal URL." },
        { status: 500 }
      )
    }
    return NextResponse.json({ url: fallbackUrl })
  }
}
