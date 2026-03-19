"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { AppBrand } from "@/components/app-brand"
import { useIsMobile } from "@/hooks/use-mobile"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserAccountButton } from "@/components/user-account-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTRPC } from "@/trpc/client"

export function DashboardHeader() {
  const isMobile = useIsMobile()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const workspaceContext = useQuery(
    trpc.account.getWorkspaceContext.queryOptions()
  )
  const switchWorkspace = useMutation(
    trpc.account.switchWorkspace.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.account.getWorkspaceContext.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.dashboard.getTrackables.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.dashboard.getMetrics.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.team.listMembers.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.team.getMemberCount.queryKey(),
          }),
        ])
      },
    })
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 sm:px-8">
        <div className="flex items-center gap-6">
          {isMobile ? <SidebarTrigger /> : null}
          <AppBrand href="/" className="text-lg font-bold tracking-tighter" />
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={workspaceContext.data?.activeWorkspace.id}
            onValueChange={(workspaceId) =>
              switchWorkspace.mutate({ workspaceId })
            }
          >
            <SelectTrigger className="hidden w-[220px] sm:flex">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {(workspaceContext.data?.workspaces ?? []).map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="h-4 w-px bg-border max-sm:hidden" />
          <UserAccountButton />
        </div>
      </div>
    </header>
  )
}
