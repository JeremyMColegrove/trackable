"use client"

import { createContext, useContext } from "react"

import { useQuery } from "@tanstack/react-query"

import { useTRPC } from "@/trpc/client"

type WorkspaceRole = "owner" | "admin" | "member" | "viewer"

type WorkspaceSummary = {
  id: string
  name: string
  slug: string
  role: WorkspaceRole
}

type ActiveWorkspace = WorkspaceSummary & {
  tier: string
}

type CreatedWorkspaceUsage = {
  current: number
  limit: number | null
}

type WorkspaceContextValue = {
  hasAdminControls: boolean
  activeWorkspace: ActiveWorkspace | null
  workspaces: WorkspaceSummary[]
  createdWorkspaceUsage: CreatedWorkspaceUsage
  currentTier: string
  canManageActiveWorkspace: boolean
  isLoading: boolean
  isFetching: boolean
  isReady: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const trpc = useTRPC()
  const workspaceQuery = useQuery(
    trpc.account.getWorkspaceContext.queryOptions()
  )
  const activeWorkspace = workspaceQuery.data?.activeWorkspace ?? null
  const currentTier = activeWorkspace?.tier ?? "free"
  const canManageActiveWorkspace =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin"

  return (
    <WorkspaceContext.Provider
      value={{
        hasAdminControls: workspaceQuery.data?.hasAdminControls ?? false,
        activeWorkspace,
        workspaces: workspaceQuery.data?.workspaces ?? [],
        createdWorkspaceUsage: workspaceQuery.data?.createdWorkspaceUsage ?? {
          current: 0,
          limit: null,
        },
        currentTier,
        canManageActiveWorkspace,
        isLoading: workspaceQuery.isLoading,
        isFetching: workspaceQuery.isFetching,
        isReady: workspaceQuery.isFetched,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext)

  if (!context) {
    throw new Error(
      "useWorkspaceContext must be used within a WorkspaceContextProvider."
    )
  }

  return context
}
