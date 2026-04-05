"use client"

import { useQuery } from "@tanstack/react-query"
import { createContext, useContext, useMemo } from "react"

import type {
  PublicAppConfig,
  PublicWorkspacePlan,
} from "@/lib/public-app-config-types"
import type { TierLimits } from "@/server/subscriptions/types"

const UNLIMITED_LIMITS: TierLimits = {
  maxTrackableItems: null,
  maxResponsesPerSurvey: null,
  maxWorkspaceMembers: null,
  maxApiLogsPerMinute: null,
  maxApiPayloadBytes: null,
  logRetentionDays: null,
  maxCreatedWorkspaces: null,
}

type AppSettings = {
  subscriptionEnforcementEnabled: boolean
  workspaceBillingEnabled: boolean
  workspacePlans: readonly PublicWorkspacePlan[]
  defaultTierId: string
  customMCPServerTokens: boolean
  getWorkspacePlan: (tierId: string) => PublicWorkspacePlan | undefined
  getTierLimits: (tierId: string) => TierLimits
  resolveWorkspaceTierFromVariantId: (variantId: string) => string | null
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
  const workspacePlans = settings?.workspacePlans ?? []
  const defaultTierId = settings?.defaultTierId ?? "free"

  const plansByTierId = useMemo(
    () =>
      workspacePlans.reduce(
        (acc, plan) => {
          acc[plan.tierId] = plan
          return acc
        },
        {} as Record<string, PublicWorkspacePlan>
      ),
    [workspacePlans]
  )

  return (
    <AppSettingsContext.Provider
      value={{
        subscriptionEnforcementEnabled:
          settings?.subscriptionEnforcementEnabled ?? false,
        workspaceBillingEnabled: settings?.workspaceBillingEnabled ?? false,
        workspacePlans,
        defaultTierId,
        customMCPServerTokens: settings?.customMCPServerTokens ?? false,
        getWorkspacePlan: (tierId) => plansByTierId[tierId],
        getTierLimits: (tierId) => plansByTierId[tierId]?.limits ?? UNLIMITED_LIMITS,
        resolveWorkspaceTierFromVariantId: (variantId) =>
          workspacePlans.find(
            (plan) => plan.lemonSqueezyVariantId === variantId
          )?.tierId ?? null,
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
