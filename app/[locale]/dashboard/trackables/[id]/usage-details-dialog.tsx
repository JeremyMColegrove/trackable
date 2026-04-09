"use client"

import { Check, Clock3, Copy, Search } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { UsageEventUrlState } from "@/lib/usage-event-search"

import { formatCompactDateTime, formatRelativeTime } from "./display-utils"
import { LogLevelBadge } from "./log-level-badge"
import type { UsageEventRow } from "./table-types"
import { HighlightedJson } from "./components/highlighted-json"
import {
  buildGroupedUsageEventFilterQuery,
  buildSimilarLogsQuery,
  formatPayloadJson,
  getSourceLabel,
} from "./utils/usage-json-helpers"
import { T, useGT } from "gt-next"

export function UsageDetailsDialog({
  usageEvent,
  onFilterToGroup,
  onOpenNearbyLogs,
  open,
  onOpenChange,
}: {
  usageEvent: UsageEventRow
  onFilterToGroup: (patch: Partial<UsageEventUrlState>) => void
  onOpenNearbyLogs: (eventId: string) => void | Promise<void>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const gt = useGT()
  const [copiedAction, setCopiedAction] = useState<
    "event-id" | "raw-json" | null
  >(null)
  const isGroupedRow =
    usageEvent.aggregation === "payload_field" && Boolean(usageEvent.groupField)
  const singleHit = usageEvent.hits[0] ?? null
  const metadata = singleHit?.metadata ?? {}
  const payload = singleHit?.payload ?? {}

  const combinedData = singleHit
    ? {
        ...payload,
        _metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      }
    : null

  const prettyJson = combinedData ? formatPayloadJson(combinedData) : null

  const groupFilterQuery = buildGroupedUsageEventFilterQuery(usageEvent)
  const similarLogsQuery = buildSimilarLogsQuery(usageEvent, metadata)
  const sourceLabel = getSourceLabel(usageEvent)

  async function handleCopy(value: string, action: "event-id" | "raw-json") {
    await navigator.clipboard.writeText(value)
    setCopiedAction(action)
    window.setTimeout(
      () => setCopiedAction((current) => (current === action ? null : current)),
      2000
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl"
      >
        <SheetHeader className="gap-0 border-b bg-muted/10 px-6 py-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {!isGroupedRow ? <LogLevelBadge level={usageEvent.level} /> : null}
            <Badge
              variant="secondary"
              className="rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground shadow-none"
            >
              {sourceLabel}
            </Badge>
          </div>

          <SheetTitle className="mb-2 flex h-7 items-center text-xl font-medium tracking-tight">
            {usageEvent.event ? (
              usageEvent.event
            ) : (
              <span className="font-normal text-muted-foreground">
                <T>&mdash;</T>
              </span>
            )}
          </SheetTitle>

          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{formatCompactDateTime(usageEvent.lastOccurredAt)}</span>
            <span className="text-border">•</span>
            <span>
              {isGroupedRow
                ? `${usageEvent.totalHits} ${gt("hits in this group")}`
                : formatRelativeTime(usageEvent.lastOccurredAt, gt)}
            </span>
          </div>

          {singleHit && !isGroupedRow && (
            <div className="mb-4 flex flex-col gap-2 rounded-md border border-border/50 bg-muted/30 p-3">
              {usageEvent.message?.trim() && (
                <div className="flex items-center justify-between">
                  <div className="text-sm whitespace-pre-wrap text-foreground">
                    {usageEvent.message.trim()}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-4 h-6 w-6 shrink-0"
                    onClick={() => void handleCopy(singleHit.id, "event-id")}
                    title={gt("Copy ID")}
                  >
                    {copiedAction === "event-id" ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              )}
              {!usageEvent.message?.trim() && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground">
                      <T>ID:</T>
                    </span>
                    <span className="font-mono">{singleHit.id}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => void handleCopy(singleHit.id, "event-id")}
                    title={gt("Copy ID")}
                  >
                    {copiedAction === "event-id" ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {similarLogsQuery && !isGroupedRow && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 bg-background text-xs shadow-xs hover:bg-muted"
                onClick={() => {
                  onFilterToGroup({
                    q: similarLogsQuery,
                    aggregate: undefined,
                  })
                }}
              >
                <Search className="size-3.5 text-muted-foreground" />

                <T>Similar Logs</T>
              </Button>
            )}
            {singleHit && !isGroupedRow && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 bg-background text-xs shadow-xs hover:bg-muted"
                onClick={() => {
                  void onOpenNearbyLogs(singleHit.id)
                }}
              >
                <Clock3 className="size-3.5 text-muted-foreground" />

                <T>Nearby Logs</T>
              </Button>
            )}
          </div>
        </SheetHeader>

        {isGroupedRow ? (
          <div className="flex-1 overflow-y-auto bg-background p-6">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium tracking-tight text-foreground">
                <T>Group Filter</T>
              </h3>
              <div className="rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-sm text-foreground">
                {groupFilterQuery}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() => {
                    if (groupFilterQuery) {
                      onFilterToGroup({
                        q: groupFilterQuery,
                        aggregate: undefined,
                      })
                    }
                  }}
                >
                  <Search className="size-4 text-muted-foreground" />

                  <T>View all logs in group</T>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 bg-muted/10">
            {prettyJson ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute top-4 right-4 z-10 text-muted-foreground shadow-xs backdrop-blur-sm hover:bg-muted"
                  onClick={() => void handleCopy(prettyJson, "raw-json")}
                >
                  {copiedAction === "raw-json" ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <pre className="min-h-full overflow-x-auto p-6 pb-10 font-mono text-[13px] leading-relaxed text-foreground/90">
                  <code>
                    <HighlightedJson json={prettyJson} />
                  </code>
                </pre>
              </>
            ) : (
              <div className="px-6 py-6 text-sm text-muted-foreground">
                <T>No payload data available.</T>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
