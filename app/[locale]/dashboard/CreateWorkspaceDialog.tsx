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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { isCreatedWorkspaceLimitMessage } from "@/lib/subscription-limit-messages"
import { useTRPC } from "@/trpc/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { T, useGT } from "gt-next"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Workspace name is required." })
    .max(80, { message: "Workspace name must be 80 characters or fewer." }),
})

type CreateWorkspaceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentWorkspaceCount: number
  maxCreatedWorkspaces: number | null
  onRequireLimitDialog: () => void
}

type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  currentWorkspaceCount,
  maxCreatedWorkspaces,
  onRequireLimitDialog,
}: CreateWorkspaceDialogProps) {
  const gt = useGT()
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const form = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
    },
  })

  const createWorkspace = useMutation(
    trpc.account.createWorkspace.mutationOptions({
      onSuccess: async () => {
        setSubmitError(null)
        form.reset()
        onOpenChange(false)

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

        router.replace("/dashboard")
      },
      onError: (error) => {
        if (isCreatedWorkspaceLimitMessage(error.message)) {
          onOpenChange(false)
          onRequireLimitDialog()
          return
        }

        setSubmitError(error.message)
      },
    })
  )

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)

    if (!nextOpen) {
      form.reset()
      setSubmitError(null)
    }
  }

  function onSubmit(values: CreateWorkspaceValues) {
    setSubmitError(null)
    createWorkspace.mutate(values)
  }

  const isSubmitting = form.formState.isSubmitting || createWorkspace.isPending
  const hasReachedWorkspaceLimit =
    maxCreatedWorkspaces !== null &&
    currentWorkspaceCount >= maxCreatedWorkspaces

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <T>Create new workspace</T>
          </DialogTitle>
          <DialogDescription>
            <T>Choose a name for the workspace you want to create.</T>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <T>Name</T>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={gt("e.g. Marketing team")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {submitError ? (
              <p className="text-sm text-destructive">{submitError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                <T>Cancel</T>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || hasReachedWorkspaceLimit}
              >
                {createWorkspace.isPending ? (
                  <T>Creating...</T>
                ) : (
                  <T>Create workspace</T>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
