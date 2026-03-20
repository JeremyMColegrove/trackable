"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import type { TrackableKind } from "@/db/schema/types"
import { getTrackableKindShortLabel } from "@/lib/trackable-kind"

export type DashboardTrackableRow = {
  id: string
  kind: TrackableKind
  name: string
  submissionCount: number
  apiUsageCount: number
  workspace: {
    name: string
  }
}

export const dashboardTrackableColumns: ColumnDef<DashboardTrackableRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trackable" />
    ),
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    enableHiding: false,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {getTrackableKindShortLabel(row.original.kind)}
      </Badge>
    ),
  },
  {
    id: "workspace",
    accessorFn: (row) => row.workspace.name,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Workspace" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.workspace.name}
      </span>
    ),
  },
  {
    accessorKey: "submissionCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submissions" />
    ),
    cell: ({ row }) => (
      <div className="font-medium tabular-nums">
        {row.original.submissionCount.toLocaleString()}
      </div>
    ),
  },
  {
    accessorKey: "apiUsageCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Logs" />
    ),
    cell: ({ row }) => (
      <div className="font-medium tabular-nums">
        {row.original.apiUsageCount.toLocaleString()}
      </div>
    ),
  },
]
