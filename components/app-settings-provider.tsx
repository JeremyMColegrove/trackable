"use client"

import { useQuery } from "@tanstack/react-query"
import { createContext, useContext, useMemo } from "react"

import type {
  PublicAppConfig,
  PublicWorkspaceTierPlan,
} from "@/lib/public-app-config-types"
import type { SubscriptionTier, TierLimits } from "@/server/subscriptions/types"

type AppSettings = {
  subscriptionEnforcementEnabled: boolean
  workspaceBillingEnabled: boolean
  workspaceTierPlans: readonly PublicWorkspaceTierPlan[]
  getWorkspaceTierPlan: (tier: SubscriptionTier) => PublicWorkspaceTierPlan
  getTierLimits: (tier: SubscriptionTier) => TierLimits
  resolveWorkspaceTierFromVariantId: (
    variantId: string
  ) => SubscriptionTier | null
  isLoading: boolean
  isReady: boolean
  refresh: () => Promise<void>
}

const AppSettingsContext = createContext<AppSettings | null>(null)

async function fetchAppSettings() {
  const response = await fetch("/api/billing/enabled", {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Failed to load application settings.")
  }

  return (await response.json()) as PublicAppConfig
}

function buildFallbackTierPlans(): PublicWorkspaceTierPlan[] {
  return [
    {
      tier: "free",
      rank: 0,
      name: "Free",
      mostPopular: false,
      priceLabel: "$0",
      priceInterval: "/workspace",
      summary: "",
      highlights: [],
      lemonSqueezyVariantId: null,
      manageUrl: null,
      limits: {
        maxTrackableItems: null,
        maxResponsesPerSurvey: null,
        maxWorkspaceMembers: null,
        maxApiLogsPerMinute: null,
        maxApiPayloadBytes: null,
        logRetentionDays: null,
      },
      tone: "neutral",
    },
    {
      tier: "plus",
      rank: 1,
      name: "Plus",
      mostPopular: false,
      priceLabel: "",
      priceInterval: "",
      summary: "",
      highlights: [],
      lemonSqueezyVariantId: null,
      manageUrl: null,
      limits: {
        maxTrackableItems: null,
        maxResponsesPerSurvey: null,
        maxWorkspaceMembers: null,
        maxApiLogsPerMinute: null,
        maxApiPayloadBytes: null,
        logRetentionDays: null,
      },
      tone: "accent",
    },
    {
      tier: "pro",
      rank: 2,
      name: "Pro",
      mostPopular: false,
      priceLabel: "",
      priceInterval: "",
      summary: "",
      highlights: [],
      lemonSqueezyVariantId: null,
      manageUrl: null,
      limits: {
        maxTrackableItems: null,
        maxResponsesPerSurvey: null,
        maxWorkspaceMembers: null,
        maxApiLogsPerMinute: null,
        maxApiPayloadBytes: null,
        logRetentionDays: null,
      },
      tone: "strong",
    },
  ]
}

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const settingsQuery = useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchAppSettings,
    staleTime: 60_000,
  })
  const settings = settingsQuery.data
  const workspaceTierPlans =
    settings?.workspaceTierPlans ?? buildFallbackTierPlans()
  const plansByTier = useMemo(
    () =>
      workspaceTierPlans.reduce(
        (plans, plan) => {
          plans[plan.tier] = plan
          return plans
        },
        {} as Record<SubscriptionTier, PublicWorkspaceTierPlan>
      ),
    [workspaceTierPlans]
  )

  return (
    <AppSettingsContext.Provider
      value={{
        subscriptionEnforcementEnabled:
          settings?.subscriptionEnforcementEnabled ?? false,
        workspaceBillingEnabled: settings?.workspaceBillingEnabled ?? false,
        workspaceTierPlans,
        getWorkspaceTierPlan: (tier) => plansByTier[tier],
        getTierLimits: (tier) => plansByTier[tier].limits,
        resolveWorkspaceTierFromVariantId: (variantId) =>
          workspaceTierPlans.find(
            (plan) => plan.lemonSqueezyVariantId === variantId
          )?.tier ?? null,
        isLoading: settingsQuery.isLoading,
        isReady: settingsQuery.isFetched,
        refresh: async () => {
          await settingsQuery.refetch()
        },
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext)

  if (!context) {
    throw new Error(
      "useAppSettings must be used within an AppSettingsProvider."
    )
  }

  return context
}
