"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Hash } from "lucide-react"

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

import { formatDateTime, formatRelativeTime } from "./display-utils"
import type { UsageEventRow } from "./table-types"

export const usageEventColumns: ColumnDef<UsageEventRow>[] = [
  {
    id: "name",
    accessorFn: (row) => row.name,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <Hash className="size-3.5" />
        </div>
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
    sortingFn: (left, right) =>
      left.original.name.localeCompare(right.original.name),
    filterFn: (row, _columnId, filterValue) => {
      return row.original.name
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    },
  },
  {
    accessorKey: "totalHits",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Hits" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.totalHits}</span>
    ),
  },
  {
    accessorKey: "lastOccurredAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Hit" />
    ),
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <div>{formatRelativeTime(row.original.lastOccurredAt)}</div>
        <div className="text-xs text-muted-foreground">
          {formatDateTime(row.original.lastOccurredAt)}
        </div>
      </div>
    ),
  },
]
