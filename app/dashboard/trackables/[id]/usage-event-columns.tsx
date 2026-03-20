"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { cn } from "@/lib/utils"

import {
  formatDateTime,
  formatStatusLabel,
} from "./display-utils"
import type { UsageEventColumn, UsageEventRow } from "./table-types"

const usageEventColumnDefinitions: Record<
  UsageEventColumn["id"],
  ColumnDef<UsageEventRow>
> = {
  event: {
    id: "event",
    accessorFn: (row) => row.event ?? "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Event" />,
    cell: ({ row }) => (
      <div className="max-w-[20rem] min-w-0">
        <span className="block truncate font-medium">
          {row.original.event ?? "—"}
        </span>
      </div>
    ),
    sortingFn: (left, right) =>
      (left.original.event ?? "").localeCompare(right.original.event ?? ""),
    filterFn: (row, _columnId, filterValue) => {
      return (row.original.event ?? "")
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    },
  },
  status: {
    id: "status",
    accessorFn: (row) => row.status ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const tone = row.original.statusTone

      return (
        <div
          className={cn(
            "inline-flex items-center gap-2 text-sm font-medium",
            tone === "error" && "text-red-700",
            tone === "ok" && "text-emerald-700",
            tone === "warning" && "text-amber-700",
            tone === "neutral" && "text-slate-600"
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              tone === "error" && "bg-red-500",
              tone === "ok" && "bg-emerald-500",
              tone === "warning" && "bg-amber-500",
              tone === "neutral" && "bg-slate-400"
            )}
          />
          <span>{row.original.status ? formatStatusLabel(row.original.status) : "—"}</span>
        </div>
      )
    },
    sortingFn: (left, right) =>
      (left.original.status ?? "").localeCompare(right.original.status ?? ""),
  },
  message: {
    id: "message",
    accessorFn: (row) => row.message ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message" />
    ),
    cell: ({ row }) => (
      <div className="max-w-[28rem] whitespace-normal break-words text-sm text-muted-foreground">
        {row.original.message ?? "—"}
      </div>
    ),
    sortingFn: (left, right) =>
      (left.original.message ?? "").localeCompare(right.original.message ?? ""),
  },
  totalHits: {
    accessorKey: "totalHits",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Hits" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.totalHits}</span>
    ),
  },
  lastOccurredAt: {
    accessorKey: "lastOccurredAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Hit" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.lastOccurredAt)}
      </span>
    ),
  },
}

export function getUsageEventColumns(
  columns: UsageEventColumn[]
): ColumnDef<UsageEventRow>[] {
  return columns
    .filter((column) => column.visible)
    .map((column) => {
      const definition = usageEventColumnDefinitions[column.id]

      return {
        ...definition,
        header: ({ column: tableColumn }) => (
          <DataTableColumnHeader column={tableColumn} title={column.label} />
        ),
      } as ColumnDef<UsageEventRow>
    })
}
