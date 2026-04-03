/** biome-ignore-all lint/correctness/useUniqueElementIds: <explanation> */
"use client"

import { useWorkspaceContext } from "@/app/[locale]/dashboard/workspace-context-provider"
import { useAppSettings } from "@/components/app-settings-provider"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useTRPC } from "@/trpc/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { T, useGT } from "gt-next"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ArchiveIcon, AlertTriangleIcon } from "lucide-react"
import { TrackablePageFrame } from "./components/trackable-page-frame"
import { useTrackableDetails } from "./trackable-shell"

const settingsSchema = z.object({
  name: z.string().min(1, "Trackable name is required"),
  description: z.string().optional(),
  apiLogRetentionDays: z.enum(["3", "7", "30", "90", "forever"]),
})

type SettingsFormValues = z.infer<typeof settingsSchema>
type SaveState = "idle" | "saving" | "saved" | "error"

const apiLogRetentionOptions = [
  { label: "3 days", value: "3" },
  { label: "1 week", value: "7" },
  { label: "1 month", value: "30" },
  { label: "3 months", value: "90" },
  { label: "Forever", value: "forever" },
] as const

function isApiLogRetentionOptionDisabled(
  value: SettingsFormValues["apiLogRetentionDays"],
  maxRetentionDays: number | null
) {
  if (maxRetentionDays === null) {
    return false
  }

  if (value === "forever") {
    return true
  }

  return Number(value) > maxRetentionDays
}

function toApiLogRetentionSelectValue(
  value: 3 | 7 | 30 | 90 | null | undefined
): SettingsFormValues["apiLogRetentionDays"] {
  switch (value) {
    case 3:
      return "3"
    case 7:
      return "7"
    case 30:
      return "30"
    case 90:
      return "90"
    default:
      return "forever"
  }
}

function fromApiLogRetentionSelectValue(
  value: SettingsFormValues["apiLogRetentionDays"]
): 3 | 7 | 30 | 90 | null {
  switch (value) {
    case "3":
      return 3
    case "7":
      return 7
    case "30":
      return 30
    case "90":
      return 90
    default:
      return null
  }
}

function TrackableSettingsPanel({ searchQuery }: { searchQuery: string }) {
  const gt = useGT()
  const router = useRouter()
  const [, setSaveState] = useState<SaveState>("idle")
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const [archiveConfirmationName, setArchiveConfirmationName] = useState("")
  const trackable = useTrackableDetails()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { getTierLimits, subscriptionEnforcementEnabled } = useAppSettings()
  const { currentTier } = useWorkspaceContext()
  const trackableQueryKey = trpc.trackables.getById.queryKey({
    id: trackable.id,
  })
  const trackableShellQueryKey = trpc.trackables.getShellById.queryKey({
    id: trackable.id,
  })
  const maxLogRetentionDays = subscriptionEnforcementEnabled
    ? getTierLimits(currentTier).logRetentionDays
    : null
  const defaultValues = useMemo<SettingsFormValues>(
    () => ({
      name: trackable.name,
      description: trackable.description ?? "",
      apiLogRetentionDays: toApiLogRetentionSelectValue(
        trackable.settings?.apiLogRetentionDays
      ),
    }),
    [trackable.description, trackable.name, trackable.settings]
  )
  const defaultSnapshot = useMemo(
    () => JSON.stringify(defaultValues),
    [defaultValues]
  )
  const isApiIngestion = trackable.kind === "api_ingestion"
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const matchesGeneralSection =
    normalizedQuery.length === 0 ||
    [
      "trackable settings",
      "name",
      "description",
      "api settings",
      "log retention",
      "3 days",
      "1 week",
      "1 month",
      "3 months",
      "forever",
      trackable.name,
      trackable.description ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  function serializeSettings(values: SettingsFormValues) {
    return JSON.stringify(values)
  }

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  })

  const updateSettings = useMutation(
    trpc.trackables.updateSettings.mutationOptions()
  )
  const archiveTrackable = useMutation(
    trpc.trackables.archive.mutationOptions({
      onSuccess: async () => {
        toast.success(gt("Trackable archived successfully."))
        setArchiveConfirmationName("")
        setIsArchiveDialogOpen(false)

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trackableQueryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: trackableShellQueryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.dashboard.getTrackables.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.dashboard.getMetrics.queryKey(),
          }),
        ])

        router.replace("/dashboard")
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  )

  async function onSubmit(values: SettingsFormValues) {
    const snapshot = serializeSettings(values)

    if (snapshot === defaultSnapshot) {
      return
    }

    setSaveState("saving")

    updateSettings.mutate(
      {
        trackableId: trackable.id,
        name: values.name,
        description: values.description ?? "",
        apiLogRetentionDays: fromApiLogRetentionSelectValue(
          values.apiLogRetentionDays
        ),
      },
      {
        onSuccess: async (_data, variables) => {
          const savedValues: SettingsFormValues = {
            name: variables.name,
            description: variables.description ?? "",
            apiLogRetentionDays: toApiLogRetentionSelectValue(
              variables.apiLogRetentionDays
            ),
          }

          form.reset(savedValues)
          setSaveState("saved")

          await queryClient.invalidateQueries({
            queryKey: trackableQueryKey,
          })
          await queryClient.invalidateQueries({
            queryKey: trackableShellQueryKey,
          })
        },
        onError: () => {
          setSaveState("error")
        },
      }
    )
  }

  const hasUnsavedChanges = form.formState.isDirty
  const isSaving = form.formState.isSubmitting || updateSettings.isPending
  const isArchivePending = archiveTrackable.isPending
  const isArchiveConfirmationMatch = archiveConfirmationName === trackable.name
  const logRetentionDescription =
    subscriptionEnforcementEnabled && maxLogRetentionDays !== null
      ? `Your current plan supports up to ${maxLogRetentionDays} days of API log retention. Upgrade to unlock longer history.`
      : gt("Choose how long API usage logs should be retained.")

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      {matchesGeneralSection ? (
        <section className="flex flex-col gap-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-6"
            >
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <T>Trackable name</T>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={gt("My trackable")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <T>Description</T>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={gt("What is this trackable for?")}
                          className="min-h-28 resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isApiIngestion ? (
                <div className="flex flex-col gap-5">
                  <FormField
                    control={form.control}
                    name="apiLogRetentionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <T>Log retention</T>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={gt("Select retention")}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {apiLogRetentionOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                disabled={isApiLogRetentionOptionDisabled(
                                  option.value,
                                  maxLogRetentionDays
                                )}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {logRetentionDescription}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset(defaultValues)
                    setSaveState("idle")
                  }}
                  disabled={!hasUnsavedChanges || isSaving}
                >
                  <T>Discard</T>
                </Button>
                <Button type="submit" disabled={!hasUnsavedChanges || isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </Form>

          <section className="overflow-hidden rounded-2xl border border-destructive/25">
            <div className="flex items-center gap-3 border-b border-destructive/25 bg-destructive/5 px-5 py-3">
              <AlertTriangleIcon className="h-4 w-4 shrink-0 text-destructive" />
              <span className="text-sm font-semibold text-destructive">
                <T>Danger zone</T>
              </span>
            </div>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <ArchiveIcon className="h-4 w-4 text-destructive" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    <T>Archive trackable</T>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <T>
                      Hide this trackable from the dashboard and stop new
                      submissions or logs.
                    </T>
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="hover:text-destructive-foreground shrink-0 border-destructive/40 text-destructive hover:bg-destructive"
                onClick={() => setIsArchiveDialogOpen(true)}
              >
                <ArchiveIcon className="mr-1.5 h-3.5 w-3.5" />
                <T>Archive</T>
              </Button>
            </div>
          </section>

          <Dialog
            open={isArchiveDialogOpen}
            onOpenChange={(open) => {
              setIsArchiveDialogOpen(open)

              if (!open) {
                setArchiveConfirmationName("")
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <ArchiveIcon className="h-5 w-5 text-destructive" />
                </div>
                <DialogTitle>
                  <T>Archive trackable</T>
                </DialogTitle>
                <DialogDescription>
                  <T>
                    This will hide the trackable from your dashboard and stop
                    new submissions or logs. Type the trackable name to confirm.
                  </T>
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2">
                <Label
                  htmlFor="archive-trackable-name"
                  className="text-sm text-muted-foreground"
                >
                  {`${gt("Type")} `}
                  <span className="font-medium text-foreground">
                    "{trackable.name}"
                  </span>
                  {` ${gt("to continue")}`}
                </Label>
                <Input
                  id="archive-trackable-name"
                  value={archiveConfirmationName}
                  onChange={(event) =>
                    setArchiveConfirmationName(event.target.value)
                  }
                  placeholder={trackable.name}
                  autoComplete="off"
                  className="font-mono text-sm"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsArchiveDialogOpen(false)
                    setArchiveConfirmationName("")
                  }}
                  disabled={isArchivePending}
                >
                  <T>Cancel</T>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!isArchiveConfirmationMatch || isArchivePending}
                  onClick={() =>
                    archiveTrackable.mutate({
                      trackableId: trackable.id,
                      confirmationName: archiveConfirmationName,
                    })
                  }
                >
                  <ArchiveIcon className="mr-1.5 h-3.5 w-3.5" />
                  {isArchivePending
                    ? gt("Archiving...")
                    : gt("Archive trackable")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      ) : null}

      {!matchesGeneralSection ? (
        <div className="rounded-2xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
          <T>No settings matched that search.</T>
        </div>
      ) : null}
    </div>
  )
}

export function TrackableSettingsSection() {
  const gt = useGT()
  const trackable = useTrackableDetails()
  const searchQuery = ""

  return (
    <TrackablePageFrame
      title={gt("Settings")}
      description={gt(
        "Update how this trackable is labeled, configured, and shared."
      )}
    >
      {trackable.permissions.canManageSettings ? (
        <TrackableSettingsPanel
          searchQuery={searchQuery}
          key={`${trackable.name}:${trackable.description ?? ""}:${
            trackable.settings?.apiLogRetentionDays ?? "forever"
          }`}
        />
      ) : (
        <div className="rounded-2xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
          <T>
            You have view access to this trackable, but only editors can update
            its settings.
          </T>
        </div>
      )}
    </TrackablePageFrame>
  )
}
