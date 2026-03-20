"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

import { formatDateTime } from "./display-utils"
import { LogLevelBadge } from "./log-level-badge"
import type { UsageEventColumn, UsageEventRow } from "./table-types"
import { useGT } from "gt-next";

const usageEventColumnDefinitions: Record<
  UsageEventColumn["id"],
  ColumnDef<UsageEventRow>
> = {
  lastOccurredAt: {
    accessorKey: "lastOccurredAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.lastOccurredAt)}
      </span>
    ),
  },
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
  level: {
    id: "level",
    accessorFn: (row) => row.level ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Level" />
    ),
    cell: ({ row }) => <LogLevelBadge level={row.original.level} />,
    sortingFn: (left, right) =>
      (left.original.level ?? "").localeCompare(right.original.level ?? ""),
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
      <DataTableColumnHeader column={column} title="Hits" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.totalHits}</span>
    ),
  },
  firstOccurredAt: {
    accessorKey: "firstOccurredAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="First Seen" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.firstOccurredAt)}
      </span>
    ),
  },
  percentage: {
    accessorKey: "percentage",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="%" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{formatPercentage(row.original.percentage)}</span>
    ),
    sortingFn: (left, right) => left.original.percentage - right.original.percentage,
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

function formatPercentage(value: number) {
  const roundedValue = Number.isInteger(value) ? String(value) : value.toFixed(1)

  return `${roundedValue}%`
}
