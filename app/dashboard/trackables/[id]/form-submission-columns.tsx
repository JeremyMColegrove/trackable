"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { LayoutTemplate } from "lucide-react"

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

import {
  formatDateTime,
  formatSubmissionSource,
} from "./display-utils"
import type { SubmissionRow } from "./table-types"

export const formSubmissionColumns: ColumnDef<SubmissionRow>[] = [
  {
    accessorKey: "submitterLabel",
    header: ({ column }) => (
      <div className="pl-4">
        <DataTableColumnHeader column={column} title="Submitter" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-3 pl-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <LayoutTemplate className="size-4" />
        </div>
        <div className="space-y-0.5">
          <div className="font-medium">{row.original.submitterLabel}</div>
          <div className="text-xs text-muted-foreground">
            {formatSubmissionSource(row.original.source)}
          </div>
        </div>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submitted" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.createdAt)}
      </span>
    ),
  },
]
