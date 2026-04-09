"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

import {
  formatCompactDateTime,
  formatUsagePayload,
  formatUsageUserAgent,
} from "./display-utils"
import type { UsageHitRow } from "./table-types"
import type { InlineTranslationOptions } from "gt-next"

type TranslateFn = (
  message: string,
  options?: InlineTranslationOptions
) => string

export function getUsageHitColumns(gt: TranslateFn): ColumnDef<UsageHitRow>[] {
  return [
    {
      accessorKey: "occurredAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={gt("Occurred At")} />
      ),
      cell: ({ row }) => formatCompactDateTime(row.original.occurredAt),
    },
    {
      id: "metadata",
      accessorFn: (row) => formatUsagePayload(row.payload),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={gt("Metadata")} />
      ),
      cell: ({ row }) => (
        <div className="break-words whitespace-normal text-muted-foreground">
          {formatUsagePayload(row.original.payload) || gt("No metadata")}
        </div>
      ),
    },
    {
      id: "userAgent",
      accessorFn: (row) => formatUsageUserAgent(row.metadata, gt),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={gt("User Agent")} />
      ),
      cell: ({ row }) => (
        <div className="break-words whitespace-normal text-muted-foreground">
          {formatUsageUserAgent(row.original.metadata, gt)}
        </div>
      ),
    },
  ]
}
