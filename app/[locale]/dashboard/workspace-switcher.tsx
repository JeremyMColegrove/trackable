"use client"

import { CreateWorkspaceDialog } from "@/app/[locale]/dashboard/CreateWorkspaceDialog"
import { useWorkspaceContext } from "@/app/[locale]/dashboard/workspace-context-provider"
import { WorkspaceCreationLimitDialog } from "@/app/[locale]/dashboard/workspace-creation-limit-dialog"
import { LimitUsageBadge } from "@/components/ui/limit-usage-badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSidebar } from "@/components/ui/sidebar"
import { useTRPC } from "@/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { T, useGT } from "gt-next"
import { Plus, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { WorkspaceSettingsDialog } from "./workspace-settings-dialog"

const CREATE_WORKSPACE_VALUE = "__create-workspace__"
const SETTINGS_VALUE = "__workspace_settings__"

export function WorkspaceSwitcher({
  triggerClassName = "w-fit border-none",
}: {
  triggerClassName?: string
}) {
  const gt = useGT()
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)
  const [isWorkspaceLimitDialogOpen, setIsWorkspaceLimitDialogOpen] =
    useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const {
    activeWorkspace,
    canManageActiveWorkspace,
    createdWorkspaceUsage,
    workspaces,
  } = useWorkspaceContext()
  const hasReachedWorkspaceCreationLimit =
    createdWorkspaceUsage.limit !== null &&
    createdWorkspaceUsage.current >= createdWorkspaceUsage.limit

  async function invalidateWorkspaceQueries() {
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
  }

  const switchWorkspace = useMutation(
    trpc.account.switchWorkspace.mutationOptions({
      onSuccess: invalidateWorkspaceQueries,
    })
  )

  function handleWorkspaceChange(workspaceId: string) {
    if (workspaceId === CREATE_WORKSPACE_VALUE) {
      if (hasReachedWorkspaceCreationLimit) {
        setIsWorkspaceLimitDialogOpen(true)
        return
      }

      setIsCreateWorkspaceOpen(true)
      return
    }
    if (workspaceId === SETTINGS_VALUE) {
      if (!canManageActiveWorkspace) {
        return
      }
      setIsSettingsOpen(true)
      return
    }

    switchWorkspace.mutate(
      { workspaceId },
      {
        onSuccess: () => {
          setOpenMobile(false)
          router.replace("/dashboard")
        },
      }
    )
  }

  return (
    <>
      <Select value={activeWorkspace?.id} onValueChange={handleWorkspaceChange}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={gt("Select workspace")} />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectGroup>
            <SelectLabel>
              <T>Workspaces</T>
            </SelectLabel>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectItem
              value={SETTINGS_VALUE}
              disabled={!canManageActiveWorkspace}
            >
              <div className="flex items-center gap-2">
                <Settings className="inline-block size-4" />
                <T>Workspace Settings</T>
              </div>
            </SelectItem>
            <SelectItem value={CREATE_WORKSPACE_VALUE}>
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Plus className="inline-block size-4" />
                  <T>Create new workspace</T>
                </div>
                {createdWorkspaceUsage.limit !== null ? (
                  <LimitUsageBadge
                    current={createdWorkspaceUsage.current}
                    limit={createdWorkspaceUsage.limit}
                  />
                ) : null}
              </div>
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <CreateWorkspaceDialog
        open={isCreateWorkspaceOpen}
        onOpenChange={setIsCreateWorkspaceOpen}
        currentWorkspaceCount={createdWorkspaceUsage.current}
        maxCreatedWorkspaces={createdWorkspaceUsage.limit}
        onRequireLimitDialog={() => setIsWorkspaceLimitDialogOpen(true)}
      />
      {createdWorkspaceUsage.limit !== null ? (
        <WorkspaceCreationLimitDialog
          open={isWorkspaceLimitDialogOpen}
          onOpenChange={setIsWorkspaceLimitDialogOpen}
          current={createdWorkspaceUsage.current}
          limit={createdWorkspaceUsage.limit}
        />
      ) : null}
      <WorkspaceSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </>
  )
}
