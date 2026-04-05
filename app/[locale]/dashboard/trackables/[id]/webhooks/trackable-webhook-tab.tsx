"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { WebhookForm } from "./webhook-form"

function WebhookFormSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="rounded-xl border">
        <div className="space-y-3 border-b px-6 py-5">
          <Skeleton className="h-6 w-44" />
        </div>
        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="order-2 flex-1 space-y-2 md:order-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="order-1 flex items-center gap-3 md:order-2 md:pb-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t pt-4">
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  )
}

export function TrackableWebhookTab({
  trackableId,
  provider,
}: {
  trackableId: string
  provider: "generic" | "discord"
}) {
  const trpc = useTRPC()

  const { data: webhooks, isLoading } = useQuery(
    trpc.trackables.listWebhooks.queryOptions({ trackableId })
  )

  if (isLoading || !webhooks) {
    return <WebhookFormSkeleton />
  }

  const existingWebhook = webhooks.find((w) => w.provider === provider)

  return (
    <div className="mt-6">
      <WebhookForm
        state={
          existingWebhook
            ? { mode: "edit", webhook: existingWebhook }
            : { mode: "create" }
        }
        trackableId={trackableId}
        providerOverride={provider}
      />
    </div>
  )
}
