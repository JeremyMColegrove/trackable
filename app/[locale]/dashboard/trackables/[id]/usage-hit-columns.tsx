"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

import {
  formatCompactDateTime,
  formatUsagePayload,
  formatUsageUserAgent,
} from "./display-utils"
import type { UsageHitRow } from "./table-types"
import { useGT } from "gt-next";

export const usageHitColumns: ColumnDef<UsageHitRow>[] = [
  {
    accessorKey: "occurredAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Occurred At" />
    ),
    cell: ({ row }) => formatCompactDateTime(row.original.occurredAt),
  },
  {
    id: "metadata",
    accessorFn: (row) => formatUsagePayload(row.payload),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Metadata" />
    ),
    cell: ({ row }) => (
      <div className="whitespace-normal break-words text-muted-foreground">
        {formatUsagePayload(row.original.payload) || "No metadata"}
      </div>
    ),
  },
  {
    id: "userAgent",
    accessorFn: (row) => formatUsageUserAgent(row.metadata),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User Agent" />
    ),
    cell: ({ row }) => (
      <div className="whitespace-normal break-words text-muted-foreground">
        {formatUsageUserAgent(row.original.metadata)}
      </div>
    ),
  },
]
