"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { LayoutTemplate } from "lucide-react"

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { getTrackableKindVisuals } from "@/lib/trackable-kind"

import { formatDateTime, formatSubmissionSource } from "./display-utils"
import type { SubmissionRow } from "./table-types"
import type { InlineTranslationOptions } from "gt-next"

type TranslateFn = (
  message: string,
  options?: InlineTranslationOptions
) => string

export function getFormSubmissionColumns(
  gt: TranslateFn
): ColumnDef<SubmissionRow>[] {
  return [
    {
      accessorKey: "submitterLabel",
      header: ({ column }) => (
        <div className="pl-4">
          <DataTableColumnHeader column={column} title={gt("Submitter")} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3 pl-4">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${getTrackableKindVisuals("survey").iconContainerClassName}`}
          >
            <LayoutTemplate className="size-4" />
          </div>
          <div className="space-y-0.5">
            <div className="font-medium">{row.original.submitterLabel}</div>
            <div className="text-xs text-muted-foreground">
              {formatSubmissionSource(row.original.source, gt)}
            </div>
          </div>
        </div>
      ),
      meta: {
        export: {
          label: gt("Submitter"),
          getValue: ({ row }) =>
            `${row.submitterLabel}\n${formatSubmissionSource(row.source, gt)}`,
        },
      },
      enableHiding: false,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={gt("Submitted")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
      meta: {
        export: {
          label: gt("Submitted"),
          getValue: ({ row }) => formatDateTime(row.createdAt),
        },
      },
    },
  ]
}

export const formSubmissionColumns = getFormSubmissionColumns((message) => message)
