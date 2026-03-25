"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { VirtualDataTable } from "@/components/ui/virtual-data-table"
import {
  createUsageEventComputedColumnId,
  isUsageEventBuiltInColumnId,
  type UsageEventUrlState,
  type UsageEventVisibleColumnId,
} from "@/lib/usage-event-search"

import type { UsageEventTableData } from "./table-types"
import { UsageDetailsDialog } from "./usage-details-dialog"
import {
  getUsageEventColumns,
  resolveUsageEventVisibleColumns,
} from "./usage-event-columns"

export function UsageEventsTableSkeleton() {
  return (
    <div className="min-w-0 space-y-4">
      <div className="max-w-full min-w-0 overflow-hidden rounded-md border shadow-xs">
        <div className="border-b bg-muted/20 px-4 py-2">
          <div className="grid grid-cols-[1.2fr_1.2fr_.8fr_1.8fr] gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              key={index}
              className="grid grid-cols-[1.2fr_1.2fr_.8fr_1.8fr] gap-4 px-4 py-2.5"
            >
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Skeleton className="h-4 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function UsageEventsTable({
  data,
  computedFieldOptions,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  onFilterToGroup,
  onGroupByField,
  onApplyFilters,
  exportFileName,
  title = "",
  description = "",
  headerButton,
}: {
  data: UsageEventTableData
  computedFieldOptions: Array<{ label: string; value: string }>
  visibleColumnIds: UsageEventVisibleColumnId[]
  onVisibleColumnIdsChange: (columnIds: UsageEventVisibleColumnId[]) => void
  onFilterToGroup: (patch: Partial<UsageEventUrlState>) => void
  onGroupByField: (field: string) => void
  onApplyFilters: (patch: Partial<UsageEventUrlState>) => void
  exportFileName: string
  title?: React.ReactNode
  description?: string
  headerButton?: React.ReactNode
}) {
  const [selectedUsageEvent, setSelectedUsageEvent] = useState<
    UsageEventTableData["rows"][number] | null
  >(null)
  const visibleColumns = useMemo(
    () => resolveUsageEventVisibleColumns(data.columns, visibleColumnIds),
    [data.columns, visibleColumnIds]
  )
  const currentVisibleColumnIds = useMemo(
    () => visibleColumns.map((column) => column.id),
    [visibleColumns]
  )
  const visibleBuiltInColumnIds = useMemo(
    () =>
      new Set(
        currentVisibleColumnIds.filter((columnId) =>
          isUsageEventBuiltInColumnId(columnId)
        )
      ),
    [currentVisibleColumnIds]
  )
  const visibleComputedColumnIds = useMemo(
    () =>
      new Set<string>(
        currentVisibleColumnIds.filter(
          (columnId) => !isUsageEventBuiltInColumnId(columnId)
        )
      ),
    [currentVisibleColumnIds]
  )
  const hiddenBuiltInColumns = useMemo(
    () =>
      data.columns.filter((column) => !visibleBuiltInColumnIds.has(column.id)),
    [data.columns, visibleBuiltInColumnIds]
  )
  const visibleColumnLabels = useMemo(
    () => new Set(visibleColumns.map((column) => column.label)),
    [visibleColumns]
  )
  const hiddenComputedFieldOptions = useMemo(
    () =>
      computedFieldOptions.filter(
        (option) =>
          !visibleColumnLabels.has(option.label) &&
          !visibleComputedColumnIds.has(
            createUsageEventComputedColumnId(option.value)
          )
      ),
    [computedFieldOptions, visibleColumnLabels, visibleComputedColumnIds]
  )

  const subtitle =
    description ||
    `${data.totalMatchedEvents} matching event${data.totalMatchedEvents === 1 ? "" : "s"} across ${data.totalGroupedRows} row${data.totalGroupedRows === 1 ? "" : "s"}.`
  const isGroupedTable = data.columns.some(
    (column) => column.id === "totalHits"
  )
  const tableColumns = useMemo(
    () =>
      getUsageEventColumns(visibleColumns, {
        enableGroupByActions: !isGroupedTable,
        availableAggregateFields: data.availableAggregateFields,
        onGroupByField,
        onRemoveColumn: (columnId) => {
          if (currentVisibleColumnIds.length <= 1) {
            return
          }

          onVisibleColumnIdsChange(
            currentVisibleColumnIds.filter(
              (visibleColumnId) => visibleColumnId !== columnId
            )
          )
        },
        canRemoveColumn: () => currentVisibleColumnIds.length > 1,
        headerTrailingContent: (
          <AddUsageEventColumnMenu
            hiddenBuiltInColumns={hiddenBuiltInColumns}
            hiddenComputedFieldOptions={hiddenComputedFieldOptions}
            onAddColumn={(columnId) => {
              if (currentVisibleColumnIds.includes(columnId)) {
                return
              }

              onVisibleColumnIdsChange([...currentVisibleColumnIds, columnId])
            }}
          />
        ),
      }),
    [
      currentVisibleColumnIds,
      data.availableAggregateFields,
      hiddenBuiltInColumns,
      hiddenComputedFieldOptions,
      isGroupedTable,
      onVisibleColumnIdsChange,
      onGroupByField,
      visibleColumns,
    ]
  )

  return (
    <>
      <VirtualDataTable
        headerButton={headerButton}
        exportOptions={{
          fileName: exportFileName,
        }}
        columns={tableColumns}
        data={data.rows}
        title={title}
        description={subtitle}
        footer={data.rows.length > 0 ? "End of logs" : undefined}
        onRowClick={setSelectedUsageEvent}
        emptyMessage="No logs have been recorded yet."
        scrollMode="window"
        estimateRowHeight={44}
        enableColumnResizing
        classNames={{
          cell: "py-1",
        }}
      />
      {selectedUsageEvent ? (
        <UsageDetailsDialog
          usageEvent={selectedUsageEvent}
          onFilterToGroup={onFilterToGroup}
          onApplyFilters={onApplyFilters}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedUsageEvent(null)
            }
          }}
        />
      ) : null}
    </>
  )
}

function AddUsageEventColumnMenu({
  hiddenBuiltInColumns,
  hiddenComputedFieldOptions,
  onAddColumn,
}: {
  hiddenBuiltInColumns: UsageEventTableData["columns"]
  hiddenComputedFieldOptions: Array<{ label: string; value: string }>
  onAddColumn: (columnId: UsageEventVisibleColumnId) => void
}) {
  const hasHiddenColumns =
    hiddenBuiltInColumns.length > 0 || hiddenComputedFieldOptions.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Add column"
          title="Add column"
          disabled={!hasHiddenColumns}
        >
          <Plus className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Add column</DropdownMenuLabel>
        {!hasHiddenColumns ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              No more columns available
            </DropdownMenuItem>
          </>
        ) : null}
        {hiddenBuiltInColumns.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Default columns</DropdownMenuLabel>
            {hiddenBuiltInColumns.map((column) => (
              <DropdownMenuItem
                key={column.id}
                onClick={() => onAddColumn(column.id)}
              >
                {column.label}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        {hiddenComputedFieldOptions.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Computed fields</DropdownMenuLabel>
            {hiddenComputedFieldOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() =>
                  onAddColumn(createUsageEventComputedColumnId(option.value))
                }
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
