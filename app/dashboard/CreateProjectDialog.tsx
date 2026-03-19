"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { DatabaseZap, FileText, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useTRPC } from "@/trpc/client"

const createTrackableSchema = z.object({
  kind: z.enum(["survey", "api_ingestion"]),
  name: z.string().min(2, {
    message: "Trackable name must be at least 2 characters.",
  }),
  description: z.string().optional(),
})

type CreateTrackableValues = z.infer<typeof createTrackableSchema>
type CreateStep = "kind" | "details"

const trackableKindOptions = [
  {
    value: "api_ingestion" as const,
    title: "API ingestion",
    description: "Record API usage events and manage ingestion keys.",
    icon: DatabaseZap,
  },
  {
    value: "survey" as const,
    title: "Survey",
    description: "Collect structured responses with a shareable form.",
    icon: FileText,
  },
]

export function CreateTrackableDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<CreateStep>("kind")
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const form = useForm<CreateTrackableValues>({
    resolver: zodResolver(createTrackableSchema),
    defaultValues: {
      kind: "survey",
      name: "",
      description: "",
    },
  })

  const selectedKind = useWatch({
    control: form.control,
    name: "kind",
  })
  const selectedKindMeta = useMemo(
    () =>
      trackableKindOptions.find((option) => option.value === selectedKind) ??
      trackableKindOptions[1],
    [selectedKind]
  )

  const createTrackable = useMutation(
    trpc.trackables.create.mutationOptions({
      onSuccess: async (createdTrackable) => {
        form.reset()
        setStep("kind")
        setOpen(false)

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.dashboard.getMetrics.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.dashboard.getTrackables.queryKey(),
          }),
        ])

        router.push(`/dashboard/trackables/${createdTrackable.id}`)
      },
    })
  )

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      form.reset()
      setStep("kind")
    }
  }

  function handleContinue() {
    setStep("details")
  }

  function handleBack() {
    setStep("kind")
  }

  function onSubmit(values: CreateTrackableValues) {
    createTrackable.mutate(values)
  }

  const isSubmitting = form.formState.isSubmitting || createTrackable.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Trackable
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "kind" ? "Create new trackable" : "Name your trackable"}
          </DialogTitle>
          <DialogDescription>
            {step === "kind"
              ? "Choose the type of trackable you want to create."
              : `Set the name and description for your ${selectedKindMeta.title.toLowerCase()} trackable.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {step === "kind" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {trackableKindOptions.map((option) => {
                  const Icon = option.icon
                  const isActive = selectedKind === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "rounded-2xl border p-5 text-left transition-colors",
                        isActive
                          ? "border-foreground bg-muted/70"
                          : "border-border/60 hover:border-foreground/40 hover:bg-muted/30"
                      )}
                      onClick={() => form.setValue("kind", option.value)}
                    >
                      <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
                        <Icon className="size-5" />
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium">{option.title}</div>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Creating a <span className="font-medium text-foreground">{selectedKindMeta.title}</span>
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            selectedKind === "api_ingestion"
                              ? "e.g. Production events"
                              : "e.g. Customer satisfaction survey"
                          }
                          {...field}
                        />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add context for collaborators and future you."
                          className="min-h-28 resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter className="pt-2">
              {step === "kind" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleContinue} disabled={isSubmitting}>
                    Continue
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {createTrackable.isPending ? "Creating..." : "Create Trackable"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
