"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { T } from "gt-next"

export function WorkspaceCreationLimitDialog({
  open,
  onOpenChange,
  current,
  limit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: number
  limit: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-none p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="bg-primary px-6 py-4 text-center sm:px-8">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-center text-xl font-bold tracking-tight text-primary-foreground">
              <T>Workspace limit reached</T>
            </DialogTitle>
            <DialogDescription className="mx-auto max-w-md text-center text-sm text-primary-foreground">
              <T>
                You have reached the maximum number of workspaces available on
                your account.
              </T>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5 sm:px-8 sm:py-6">
          <div className="space-y-3 text-sm leading-6 text-foreground">
            <p>
              <T>If you need more workspaces, you can:</T>
            </p>
            <ul className="list-disc space-y-1 pl-5 text-foreground marker:text-muted-foreground">
              <li>
                <T>Join another workspace</T>
              </li>
              <li>
                <T>Archive an unused workspace before creating a new one</T>
              </li>
              <li>
                <T>Contact support if you need a higher workspace limit</T>
              </li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              <T>Close</T>
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
