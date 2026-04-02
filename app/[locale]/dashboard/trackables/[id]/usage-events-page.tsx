/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <explanation> */
"use client"

import type { DateRangeValue } from "@/components/date-range-input"
import { Button } from "@/components/ui/button"
import { LiqeInput } from "@/components/ui/liqe-input"
import { buildTableExportFileName } from "@/lib/table-export"
import {
  buildAppliedUsageEventTimeRangeUrlState,
  buildUsageEventSearchInput,
  buildUsageEventUrlSearchParams,
  getUsageEventPresetRange,
  normalizeUsageEventUrlState,
  parseUsageEventVisibleColumnIds,
  stringifyUsageEventVisibleColumnIds,
  type UsageEventUrlState,
  type UsageEventVisibleColumnId,
} from "@/lib/usage-event-search"
import { useTRPC } from "@/trpc/client"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { T, useGT } from "gt-next"
import { ArrowUp, FilterIcon, LoaderCircle, RefreshCw } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { TrackablePageFrame } from "./components/trackable-page-frame"
import {
  UsageSelectFilter,
  UsageTimeRangeFilter,
} from "./components/usage-filters"
import { formatUsageFieldLabel } from "./display-utils"
import type { UsageEventTableData } from "./table-types"
import { TrackableTableErrorState } from "./trackable-table-error-state"
import { useTrackableDetails } from "./trackable-shell"
import { getDefaultUsageEventVisibleColumnIds } from "./usage-event-columns"
import { mergeUsageEventTablePages } from "./usage-event-table-data"
import {
  UsageEventsTable,
  UsageEventsTableSkeleton,
} from "./usage-events-table"

function buildAppliedTimeRangeValue(
  urlState: UsageEventUrlState
): DateRangeValue | null {
  if (urlState.range === "custom") {
    if (!urlState.from || !urlState.to) {
      return null
    }

    return {
      start: new Date(urlState.from),
      end: new Date(urlState.to),
      source: "custom",
      rawInput: `${urlState.from} -> ${urlState.to}`,
    }
  }

  if (!urlState.range) {
    return null
  }

  const resolvedRange = getUsageEventPresetRange(urlState.range, new Date())

  if (!resolvedRange) {
    return null
  }

  return {
    start: new Date(resolvedRange.from),
    end: new Date(resolvedRange.to),
    source: "preset",
    presetKey: urlState.range,
  }
}

function buildDraftTimeRangeUrlState(
  value: DateRangeValue | null
): Pick<UsageEventUrlState, "range" | "from" | "to"> {
  if (!value) {
    return {
      range: undefined,
      from: undefined,
      to: undefined,
    }
  }

  if (value.source === "preset" && value.presetKey) {
    return {
      range: value.presetKey as UsageEventUrlState["range"],
      from: undefined,
      to: undefined,
    }
  }

  return {
    range: "custom",
    from: value.start.toISOString(),
    to: value.end.toISOString(),
  }
}

function areDateRangeValuesEqual(
  left: DateRangeValue | null,
  right: DateRangeValue | null
) {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return (
    left.start.getTime() === right.start.getTime() &&
    left.end.getTime() === right.end.getTime() &&
    left.source === right.source &&
    left.presetKey === right.presetKey
  )
}

export function UsageEventsPage() {
  const gt = useGT()
  const trackable = useTrackableDetails()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draftQuery, setDraftQuery] = useState("")
  const [draftAggregateField, setDraftAggregateField] = useState("")
  const [draftTimeRange, setDraftTimeRange] = useState<DateRangeValue | null>(
    null
  )
  const [isRefreshingTable, setIsRefreshingTable] = useState(false)
  const [showJumpToTop, setShowJumpToTop] = useState(false)
  const searchSectionRef = useRef<HTMLDivElement | null>(null)
  const normalizedUrlState = useMemo(
    () => normalizeUsageEventUrlState(searchParams),
    [searchParams]
  )
  const appliedQuery = normalizedUrlState.q ?? ""
  const appliedAggregateField = normalizedUrlState.aggregate ?? ""
  const appliedVisibleColumnIds = useMemo(
    () => parseUsageEventVisibleColumnIds(normalizedUrlState.cols),
    [normalizedUrlState.cols]
  )
  const appliedTimeRange = useMemo(
    () => buildAppliedTimeRangeValue(normalizedUrlState),
    [normalizedUrlState]
  )
  const hasPendingQueryChange = draftQuery.trim() !== appliedQuery.trim()
  const hasPendingAggregateChange =
    draftAggregateField.trim() !== appliedAggregateField.trim()
  const hasPendingTimeRangeChange = !areDateRangeValuesEqual(
    draftTimeRange,
    appliedTimeRange
  )
  const hasPendingTableChange =
    hasPendingQueryChange ||
    hasPendingAggregateChange ||
    hasPendingTimeRangeChange
  const searchInput = useMemo(
    () => buildUsageEventSearchInput(trackable.id, normalizedUrlState),
    [normalizedUrlState, trackable.id]
  )
  const usageEventTableQuery = useInfiniteQuery(
    trpc.trackables.getUsageEventTable.infiniteQueryOptions(searchInput, {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      retry: false,
      refetchOnWindowFocus: false,
      placeholderData: (previousData) => previousData,
    })
  )
  const usageEventTableData = useMemo<UsageEventTableData | null>(
    () => mergeUsageEventTablePages(usageEventTableQuery.data?.pages),
    [usageEventTableQuery.data]
  )
  const hasTableError = usageEventTableQuery.isError
  const tableErrorMessage = usageEventTableQuery.error?.message
  const trimmedTableErrorMessage = tableErrorMessage?.trim()
  const shouldShowRawTableErrorMessage =
    trimmedTableErrorMessage !== undefined &&
    trimmedTableErrorMessage.length > 0 &&
    trimmedTableErrorMessage.toLowerCase() !== "load failed"
  const computedFieldOptions = useMemo(
    () =>
      (usageEventTableData?.availableAggregateFields ?? []).map((field) => ({
        label: formatUsageFieldLabel(field),
        value: field,
      })),
    [usageEventTableData?.availableAggregateFields]
  )
  const groupByOptions = useMemo(
    () => [{ label: "None", value: "__none__" }, ...computedFieldOptions],
    [computedFieldOptions]
  )

  useEffect(() => {
    setDraftQuery(appliedQuery)
  }, [appliedQuery])

  useEffect(() => {
    setDraftAggregateField(appliedAggregateField)
  }, [appliedAggregateField])

  useEffect(() => {
    setDraftTimeRange(appliedTimeRange)
  }, [appliedTimeRange])

  useEffect(() => {
    const searchSection = searchSectionRef.current

    if (!searchSection) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowJumpToTop(!entry?.isIntersecting)
      },
      {
        threshold: 0.1,
      }
    )

    observer.observe(searchSection)

    return () => observer.disconnect()
  }, [])

  function updateUrlState(patch: Partial<UsageEventUrlState>) {
    const nextParams = buildUsageEventUrlSearchParams({
      ...normalizedUrlState,
      ...patch,
    })
    const nextSearch = nextParams.toString()
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname

    startTransition(() => {
      router.replace(nextUrl, { scroll: false })
    })
  }

  function handleFilterToGroup(patch: Partial<UsageEventUrlState>) {
    const nextParams = buildUsageEventUrlSearchParams({
      ...normalizedUrlState,
      ...buildAppliedUsageEventTimeRangeUrlState(searchInput),
      ...patch,
      aggregate: undefined,
    })
    const nextSearch = nextParams.toString()
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname

    window.open(nextUrl, "_blank", "noopener,noreferrer")
  }

  function handleGroupByField(field: string) {
    const nextParams = buildUsageEventUrlSearchParams({
      ...normalizedUrlState,
      ...buildAppliedUsageEventTimeRangeUrlState(searchInput),
      aggregate: field,
    })
    const nextSearch = nextParams.toString()
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname

    window.open(nextUrl, "_blank", "noopener,noreferrer")
  }

  function handleVisibleColumnIdsChange(
    columnIds: UsageEventVisibleColumnId[]
  ) {
    const defaultVisibleColumnIds = usageEventTableData
      ? getDefaultUsageEventVisibleColumnIds(usageEventTableData.columns)
      : []
    const normalizedColumnState =
      columnIds.length === defaultVisibleColumnIds.length &&
      columnIds.every(
        (columnId, index) => columnId === defaultVisibleColumnIds[index]
      )
        ? undefined
        : stringifyUsageEventVisibleColumnIds(columnIds)

    updateUrlState({
      cols: normalizedColumnState,
    })
  }

  async function handleRefreshTable() {
    setIsRefreshingTable(true)

    try {
      await usageEventTableQuery.refetch()
    } finally {
      setIsRefreshingTable(false)
    }
  }

  async function handleUpdateTable() {
    if (hasPendingTableChange) {
      updateUrlState({
        q: draftQuery,
        aggregate: draftAggregateField.trim() || undefined,
        ...buildDraftTimeRangeUrlState(draftTimeRange),
      })
    }
  }

  function handleJumpToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  function handleSortChange(
    sort: UsageEventUrlState["sort"],
    dir: UsageEventUrlState["dir"]
  ) {
    updateUrlState({
      dir,
      sort,
    })
  }

  async function handleOpenNearbyLogs(eventId: string) {
    const bounds = await queryClient.fetchQuery(
      trpc.trackables.getUsageEventContextBounds.queryOptions(
        {
          trackableId: trackable.id,
          eventId,
          before: 5,
          after: 5,
        },
        {
          retry: false,
        }
      )
    )

    if (!bounds.from || !bounds.to) {
      return
    }

    const nextParams = buildUsageEventUrlSearchParams({
      ...normalizedUrlState,
      q: undefined,
      aggregate: undefined,
      range: "custom",
      from: bounds.from,
      to: bounds.to,
    })
    const nextSearch = nextParams.toString()
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname

    window.open(nextUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <>
      <div className="fixed top-4 left-1/2 z-40 -translate-x-1/2">
        <Button
          type="button"
          variant="outline"
          onClick={handleJumpToTop}
          className={`h-11 rounded-full border-border/70 bg-background/95 px-4 shadow-lg backdrop-blur transition-all duration-200 ${
            showJumpToTop
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0"
          }`}
          tabIndex={showJumpToTop ? 0 : -1}
          aria-hidden={!showJumpToTop}
        >
          <ArrowUp className="size-4" />
          <T>Jump to top</T>
        </Button>
      </div>
      <TrackablePageFrame
        title={gt("Logs")}
        description={gt("Review, filter, and export the logs you've collected.")}
        search={
          <div ref={searchSectionRef} className="flex flex-col gap-3">
            <div className="flex flex-row items-center gap-3">
              <div className="min-w-0 flex-1">
                <LiqeInput
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  onSubmit={() => void handleUpdateTable()}
                  placeholder={gt(
                    'Filter events with liqe, for example `event:"signup"`'
                  )}
                  type="search"
                  className="h-12 rounded-2xl border-border/60 bg-background shadow-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void handleUpdateTable()}
                  className="h-12 rounded-2xl px-4"
                  disabled={usageEventTableQuery.isLoading || !hasPendingTableChange}
                >
                  <FilterIcon />
                  <T>Apply filter</T>
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-3 pl-4">
              <div className="h-6 w-8 rounded-bl-3xl border-b border-l border-border" />
              <div className="flex w-full flex-wrap gap-4">
                <UsageTimeRangeFilter
                  value={draftTimeRange}
                  onValueChange={setDraftTimeRange}
                />
                <UsageSelectFilter
                  label={gt("Group By")}
                  value={draftAggregateField || "__none__"}
                  placeholder={gt("None")}
                  onValueChange={(value) =>
                    setDraftAggregateField(value === "__none__" ? "" : value)
                  }
                  options={groupByOptions}
                />
              </div>
            </div>
          </div>
        }
      >
        {hasTableError ? (
          <TrackableTableErrorState
            title={<T>We could not load the logs</T>}
            description={
              shouldShowRawTableErrorMessage ? (
                trimmedTableErrorMessage
              ) : (
                <T>Try refreshing the page and loading the table again.</T>
              )
            }
            actionLabel={<T>Refresh data</T>}
            onAction={() => void handleRefreshTable()}
            isActionPending={isRefreshingTable || usageEventTableQuery.isLoading}
          />
        ) : usageEventTableData ? (
          <UsageEventsTable
            exportFileName={buildTableExportFileName(trackable.name, "logs")}
            computedFieldOptions={computedFieldOptions}
            currentSort={searchInput.sort}
            currentSortDirection={searchInput.dir}
            headerButton={
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void handleRefreshTable()}
                disabled={isRefreshingTable || usageEventTableQuery.isLoading}
                aria-label={gt("Refresh data")}
                title={gt("Refresh data")}
              >
                {isRefreshingTable ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
              </Button>
            }
            data={usageEventTableData}
            endMessage={
              usageEventTableData.rows.length === 0
                ? undefined
                : usageEventTableData.hasMore
                  ? undefined
                  : gt("End of logs")
            }
            isFetchingNextPage={usageEventTableQuery.isFetchingNextPage}
            onLoadMore={() => void usageEventTableQuery.fetchNextPage()}
            visibleColumnIds={appliedVisibleColumnIds}
            onVisibleColumnIdsChange={handleVisibleColumnIdsChange}
            onFilterToGroup={handleFilterToGroup}
            onOpenNearbyLogs={handleOpenNearbyLogs}
            onGroupByField={handleGroupByField}
            onSortChange={handleSortChange}
          />
        ) : (
          <UsageEventsTableSkeleton />
        )}
      </TrackablePageFrame>
    </>
  )
}
