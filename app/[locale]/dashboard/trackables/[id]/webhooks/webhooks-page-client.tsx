"use client"

import { useWorkspaceContext } from "@/app/[locale]/dashboard/workspace-context-provider"
import { useTrackableDetails } from "../trackable-shell"
import { TrackablePageFrame } from "../components/trackable-page-frame"
import { T, useGT } from "gt-next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrackableWebhookTab } from "./trackable-webhook-tab"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

function StatusDot({ webhook }: { webhook?: { enabled: boolean } }) {
  if (!webhook) return null
  return (
    <div
      className={cn(
        "ml-2 size-2 rounded-full",
        webhook.enabled ? "bg-green-500" : "bg-orange-500"
      )}
    />
  )
}

export function WebhooksPageClient() {
  const gt = useGT()
  const trackable = useTrackableDetails()
  const trpc = useTRPC()
  const canManageWebhooks = trackable.permissions.canManageSettings
  const description =
    trackable.kind === "survey"
      ? gt(
          "Configure webhooks to receive real-time notifications about survey responses."
        )
      : gt(
          "Configure webhooks to receive real-time notifications about incoming logs."
        )

  const { data: webhooks } = useQuery(
    trpc.trackables.listWebhooks.queryOptions(
      { trackableId: trackable.id },
      { enabled: canManageWebhooks }
    )
  )

  const discordWebhook = webhooks?.find((w) => w.provider === "discord")
  const genericWebhook = webhooks?.find((w) => w.provider === "generic")

  if (!canManageWebhooks) {
    return (
      <TrackablePageFrame title={gt("Webhooks")} description={description}>
        <div className="rounded-2xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
          <T>
            You have view access to this trackable, but only editors can manage
            its webhooks.
          </T>
        </div>
      </TrackablePageFrame>
    )
  }

  return (
    <TrackablePageFrame title={gt("Webhooks")} description={description}>
      <Tabs defaultValue="generic" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="generic">
            <T>General Webhook</T>
            <StatusDot webhook={genericWebhook} />
          </TabsTrigger>
          <TabsTrigger value="discord">
            <T>Discord Webhook</T>
            <StatusDot webhook={discordWebhook} />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="generic">
          <TrackableWebhookTab
            trackableId={trackable.id}
            provider="generic"
            canManageWebhooks={canManageWebhooks}
          />
        </TabsContent>
        <TabsContent value="discord">
          <TrackableWebhookTab
            trackableId={trackable.id}
            provider="discord"
            canManageWebhooks={canManageWebhooks}
          />
        </TabsContent>
      </Tabs>
    </TrackablePageFrame>
  )
}
