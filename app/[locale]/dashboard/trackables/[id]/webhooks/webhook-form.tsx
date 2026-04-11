/** biome-ignore-all lint/correctness/useUniqueElementIds: <explanation> */
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { LiqeInput } from "@/components/ui/liqe-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useTRPC } from "@/trpc/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { T, useGT } from "gt-next"
import { Edit2, Loader2, MoreVertical, Play, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useTrackableDetails } from "../trackable-shell"

export type WebhookFormState =
  | { mode: "create"; webhook?: never }
  | { mode: "edit"; webhook: any }

const ruleSchema = z
  .object({
    enabled: z.boolean(),
    type: z.enum(["log_match", "log_count_match", "survey_response_received"]),
    liqeQuery: z.string(),
    windowMinutes: z.number().min(1).optional(),
    matchCount: z.number().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.type !== "survey_response_received" &&
      value.liqeQuery.trim().length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Filter is required",
        path: ["liqeQuery"],
      })
    }

    if (value.type === "log_count_match" && !value.windowMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Time window is required",
        path: ["windowMinutes"],
      })
    }

    if (value.type === "log_count_match" && !value.matchCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Match count is required",
        path: ["matchCount"],
      })
    }
  })

const formSchema = z
  .object({
    enabled: z.boolean(),
    provider: z.enum(["generic", "discord", "microsoft_teams"]),
    url: z.string().trim(),
    username: z.string().optional(),
    secret: z.string().optional(),
    triggerRules: z
      .array(ruleSchema)
      .min(1, "At least one trigger is required"),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) {
      return
    }

    if (value.url.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target URL is required",
        path: ["url"],
      })
      return
    }

    if (!z.url().safeParse(value.url).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a valid URL",
        path: ["url"],
      })
    }
  })

type FormData = z.infer<typeof formSchema>
type RuleData = z.infer<typeof ruleSchema>

export function WebhookForm({
  state,
  trackableId,
  providerOverride,
}: {
  state: WebhookFormState
  trackableId: string
  providerOverride: "generic" | "discord" | "microsoft_teams"
}) {
  const gt = useGT()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const trackable = useTrackableDetails()
  const isSurveyTrackable = trackable.kind === "survey"

  const defaultValues: FormData =
    state.mode === "edit"
      ? {
          enabled: state.webhook.enabled,
          provider: state.webhook.provider.provider ?? state.webhook.provider,
          url: state.webhook.config.url,
          username: state.webhook.config.username ?? "",
          secret: state.webhook.config.secret ?? "",
          triggerRules: state.webhook.triggerRules.map((rule: any) => ({
            enabled: rule.enabled,
            type: rule.config.type,
            liqeQuery: "liqeQuery" in rule.config ? rule.config.liqeQuery : "*",
            windowMinutes: rule.config.windowMinutes,
            matchCount: rule.config.matchCount,
          })),
        }
      : {
          enabled: false,
          provider: providerOverride,
          url: "",
          username: "",
          secret: "",
          triggerRules: isSurveyTrackable
            ? [
                {
                  enabled: true,
                  type: "survey_response_received",
                  liqeQuery: "*",
                },
              ]
            : [{ enabled: true, type: "log_match", liqeQuery: "*" }],
        }

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const {
    fields: ruleFields,
    append: appendRule,
    remove: removeRule,
    update: updateRule,
  } = useFieldArray({
    control: form.control,
    name: "triggerRules",
  })

  // Rule Dialog State
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null)
  const isRuleDialogOpen = !isSurveyTrackable && editingRuleIndex !== null

  const ruleForm = useForm<RuleData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      enabled: true,
      type: "log_match",
      liqeQuery: "*",
      matchCount: 10,
      windowMinutes: 5,
    },
  })

  // Watch entire form array to re-render the table properly instead of relying purely on un-watched fields array
  const currentRules = form.watch("triggerRules")

  const openRuleDialog = (index?: number) => {
    if (isSurveyTrackable) {
      return
    }

    if (index !== undefined) {
      setEditingRuleIndex(index)
      ruleForm.reset(form.getValues().triggerRules[index])
    } else {
      setEditingRuleIndex(-1)
      ruleForm.reset({
        enabled: true,
        type: "log_match",
        liqeQuery: "*",
        matchCount: 10,
        windowMinutes: 5,
      })
    }
  }

  const handleRuleSubmit = (data: RuleData) => {
    if (editingRuleIndex === -1) {
      appendRule(data)
    } else if (editingRuleIndex !== null) {
      updateRule(editingRuleIndex, data)
    }
    setEditingRuleIndex(null)
  }

  const saveMutation = useMutation(
    trpc.trackables.saveWebhook.mutationOptions()
  )
  const testMutation = useMutation(
    trpc.trackables.testWebhook.mutationOptions()
  )
  const webhookListQueryKey = trpc.trackables.listWebhooks.queryKey({
    trackableId,
  })

  function buildPayload(values: FormData) {
    const providerConfig: any =
      values.provider === "generic"
        ? {
            provider: "generic",
            url: values.url,
            secret: values.secret || undefined,
            headers: {},
          }
        : values.provider === "microsoft_teams"
          ? {
              provider: "microsoft_teams",
              url: values.url,
            }
        : {
            provider: "discord",
            url: values.url,
            username: values.username || undefined,
          }

    return {
      trackableId,
      enabled: values.enabled,
      provider: providerConfig,
      triggerRules: isSurveyTrackable
        ? [
            {
              enabled: true,
              config: { type: "survey_response_received" as const },
            },
          ]
        : values.triggerRules.map((r) => ({
            enabled: r.enabled,
            config:
              r.type === "log_match"
                ? { type: "log_match" as const, liqeQuery: r.liqeQuery }
                : {
                    type: "log_count_match" as const,
                    liqeQuery: r.liqeQuery,
                    windowMinutes: r.windowMinutes || 5,
                    matchCount: r.matchCount || 10,
                  },
          })),
    }
  }

  function handleRuleEnabledChange(index: number, enabled: boolean) {
    const currentRule = form.getValues(`triggerRules.${index}`)
    if (!currentRule) {
      return
    }

    updateRule(index, {
      ...currentRule,
      enabled,
    })
  }

  async function onSubmit(values: FormData) {
    await saveMutation.mutateAsync(buildPayload(values))
    toast.success(
      state.mode === "create"
        ? gt("Webhook created successfully.")
        : gt("Webhook updated successfully.")
    )
    form.reset(values)

    queryClient.invalidateQueries({
      queryKey: webhookListQueryKey,
    })
  }

  function handleEnabledChange(enabled: boolean) {
    form.setValue("enabled", enabled, { shouldDirty: true })
  }

  async function onTest(values: FormData) {
    try {
      const result = await testMutation.mutateAsync(buildPayload(values))

      if (!result.ok) {
        throw new Error(
          result.errorMessage ??
            (result.status
              ? `Webhook responded with status ${result.status}.`
              : "Webhook test delivery failed.")
        )
      }

      toast.success(gt("Test event sent successfully."))
    } catch (e: any) {
      toast.error(gt("Failed to test webhook: ") + e.message)
    }
  }

  const isPending = saveMutation.isPending
  const isTesting = testMutation.isPending
  const isDirty = form.formState.isDirty
  const isEnabled = form.watch("enabled")

  const watchUrl = form.watch("url")
  const isDiscordUrlValid =
    watchUrl &&
    (watchUrl.startsWith("https://discord.com/api/webhooks/") ||
      watchUrl.startsWith("https://discordapp.com/api/webhooks/"))

  const ruleColumns: ColumnDef<RuleData>[] = [
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={<T>Type</T>} />
      ),
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {row.original.type === "log_match" ? "Log Match" : "Count Match"}
        </Badge>
      ),
    },
    {
      accessorKey: "liqeQuery",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={<T>Filter</T>} />
      ),
      cell: ({ row }) => (
        <code className="rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
          {row.original.liqeQuery || "*"}
        </code>
      ),
    },
    {
      id: "threshold",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={<T>Threshold</T>} />
      ),
      cell: ({ row }) =>
        row.original.type === "log_count_match" ? (
          <span className="text-sm text-muted-foreground">
            {row.original.matchCount} in {row.original.windowMinutes}m
          </span>
        ) : (
          <span className="text-sm text-muted-foreground opacity-50">—</span>
        ),
    },
    {
      id: "actions",
      header: () => (
        <div className="text-right">
          <T>Actions</T>
        </div>
      ),
      cell: ({ row }) => {
        const index = row.index
        return (
          <div className="flex items-center justify-end gap-3">
            <Switch
              checked={row.original.enabled}
              onCheckedChange={(enabled) =>
                handleRuleEnabledChange(index, enabled)
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openRuleDialog(index)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  <T>Edit Rule</T>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => removeRule(index)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <T>Delete Rule</T>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* <div className="flex items-start justify-between">
				<div className="flex items-center space-x-2 rounded-lg border p-3 shadow-sm bg-card">
					<Label
						className="text-sm font-medium cursor-pointer"
						htmlFor="enable-switch"
					>
						<T>Enable notifications</T>
					</Label>
					<Switch
						id="enable-switch"
						checked={form.watch("enabled")}
						onCheckedChange={(val) =>
							form.setValue("enabled", val, { shouldDirty: true })
						}
					/>
				</div>
			</div> */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Connection Section */}
          <Card>
            <CardHeader>
              <CardTitle>
                <T>Connection Settings</T>
              </CardTitle>
            </CardHeader>
            <CardContent className="mt-4">
              <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <div className="order-2 flex-1 md:order-1">
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <T>Target URL</T>
                          </FormLabel>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <FormControl>
                                <Input
                                  type="url"
                                  placeholder="https://..."
                                  autoComplete="off"
                                  inputMode="url"
                                  autoCapitalize="none"
                                  autoCorrect="off"
                                  spellCheck={false}
                                  data-form-type="other"
                                  {...field}
                                />
                              </FormControl>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="order-1 flex items-center justify-start pb-1 md:order-2 md:justify-center md:pb-2">
                    <div className="flex flex-col items-start gap-1">
                      <p className="text-sm text-muted-foreground">
                        {isEnabled ? <T>Enabled</T> : <T>Not enabled</T>}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Label
                          className="cursor-pointer text-sm font-medium"
                          htmlFor="enable-switch"
                        >
                          <T>Enable notifications</T>
                        </Label>
                        <Switch
                          id="enable-switch"
                          checked={isEnabled}
                          disabled={isPending || isTesting}
                          onCheckedChange={handleEnabledChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {providerOverride === "generic" && (
                  <FormField
                    control={form.control}
                    name="secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <T>Signing Secret (Optional)</T>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="***"
                            autoComplete="new-password"
                            data-form-type="other"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          <T>Used to sign the payload request</T>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {/* {providerOverride === "discord" && (
									<div className="md:col-span-1">
										<FormField
											control={form.control}
											name="username"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														<T>Bot Username (Optional)</T>
													</FormLabel>
													<FormControl>
														<Input placeholder="System Bot" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
								)} */}
              </div>
            </CardContent>
          </Card>

          {/* Trigger Rules Section */}
          {isSurveyTrackable ? null : (
            <div className="space-y-4">
              <DataTable
                columns={ruleColumns}
                data={currentRules}
                title={<T>Trigger Rules</T>}
                description={
                  <T>Define when payloads should be sent to this webhook.</T>
                }
                headerButton={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openRuleDialog()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <T>Add Rule</T>
                  </Button>
                }
                emptyMessage={<T>No rules defined.</T>}
                showViewOptions={false}
                initialPageSize={10}
              />
              {form.formState.errors.triggerRules?.root && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.triggerRules.root.message}
                </p>
              )}
              {form.formState.errors.triggerRules &&
                !form.formState.errors.triggerRules.root && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.triggerRules.message}
                  </p>
                )}
            </div>
          )}

          <div className="flex items-center gap-4 border-t pt-4">
            <Button
              type="submit"
              disabled={!isDirty || isPending || isTesting}
              className="min-w-[140px]"
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {state.mode === "create"
                ? gt("Save Webhook")
                : gt("Save Changes")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void form.handleSubmit(onTest)()}
              disabled={isPending || isTesting}
            >
              {isTesting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              <T>Test Webhook</T>
            </Button>
          </div>
        </form>
      </Form>

      {/* Embedded Dialog for Rule Editing */}
      {isSurveyTrackable ? null : (
        <Dialog
          open={isRuleDialogOpen}
          onOpenChange={(open) => !open && setEditingRuleIndex(null)}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingRuleIndex === -1 ? <T>Add Rule</T> : <T>Edit Rule</T>}
              </DialogTitle>
            </DialogHeader>
            <Form {...ruleForm}>
              <form
                onSubmit={ruleForm.handleSubmit(handleRuleSubmit)}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <FormField
                    control={ruleForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <T>Trigger Type</T>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="log_match">
                              <T>Log Matches Filter</T>
                            </SelectItem>
                            <SelectItem value="log_count_match">
                              <T>Log Count Threshold</T>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={ruleForm.control}
                    name="liqeQuery"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <T>Log Filter (Liqe Format)</T>
                        </FormLabel>
                        <FormControl>
                          <LiqeInput
                            placeholder='e.g. level:error AND event:"signup_failed"'
                            hint={
                              <T>
                                Example: `level:error AND event:"signup_failed"`
                              </T>
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {ruleForm.watch("type") === "log_count_match" && (
                  <div className="grid grid-cols-1 gap-6 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
                    <FormField
                      control={ruleForm.control}
                      name="matchCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <T>Match Count Threshold</T>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="10"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 1)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={ruleForm.control}
                      name="windowMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <T>Time Window (Minutes)</T>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="5"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 1)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingRuleIndex(null)}
                  >
                    <T>Cancel</T>
                  </Button>
                  <Button type="submit">
                    <T>Save Rule</T>
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
