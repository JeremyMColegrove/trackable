"use client"

import { useWorkspaceContext } from "@/app/[locale]/dashboard/workspace-context-provider"
import { useAppSettings } from "@/components/app-settings-provider"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { T } from "gt-next"

export function WorkspaceTierSection({
  onOpenDialog,
}: {
  onOpenDialog: (currentTier: string) => void
}) {
  const { currentTier, isLoading } = useWorkspaceContext()
  const { getWorkspacePlan, workspacePlans } = useAppSettings()
  const { setOpenMobile } = useSidebar()

  // Wait until loading finishes to avoid flicker
  if (isLoading) return null

  const plan = getWorkspacePlan(currentTier)
  const highestPlan = workspacePlans[workspacePlans.length - 1]
  const isHighestTier = highestPlan ? currentTier === highestPlan.tierId : false

  const handleOpenDialog = () => {
    onOpenDialog(currentTier)
    setOpenMobile(false)
  }

  return (
    <button
      type="button"
      onClick={handleOpenDialog}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left text-sm transition-colors hover:bg-sidebar-accent"
      )}
    >
      <div className="flex flex-col gap-0.5 leading-none">
        <span className="text-[10px] font-medium tracking-wider text-sidebar-foreground/50 uppercase transition-colors group-hover:text-primary/70">
          <T>Workspace Plan</T>
        </span>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="font-semibold text-primary transition-colors">
            {plan?.name ?? currentTier}
          </span>
        </div>
      </div>

      <span className="pr-1 text-xs font-semibold opacity-60 transition-colors hover:opacity-100">
        {isHighestTier ? <T>View</T> : <T>Upgrade</T>}
      </span>
    </button>
  )
}
