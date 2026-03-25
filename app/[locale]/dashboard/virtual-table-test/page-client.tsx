"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { VirtualDataTable } from "@/components/ui/virtual-data-table"
import { VirtualDataTableColumnHeader } from "@/components/ui/virtual-data-table-column-header"
import { T } from "gt-next"
import { LayoutList } from "lucide-react"

type MockData = {
  id: string
  name: string
  status: string
  createdAt: string
  value: number
}

function createMockData(rowCount: number): MockData[] {
  const baseTimestamp = Date.UTC(2025, 0, 1)

  return Array.from({ length: rowCount }, (_, i) => ({
    id: `EVT-${i.toString().padStart(6, "0")}`,
    name: `Mock Item ${i}`,
    status: i % 3 === 0 ? "active" : i % 3 === 1 ? "pending" : "archived",
    createdAt: new Date(baseTimestamp + i * 60_000).toISOString(),
    value: (i * 13.37) % 1000,
  }))
}

const columns: ColumnDef<MockData>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <VirtualDataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs">{row.getValue("id")}</div>
    ),
    meta: {
      virtualTable: {
        width: "8rem",
      },
    },
  },
  {
    accessorKey: "name",
    header: ({ column, table }) => {
      const virtualTableMeta = table.options.meta?.virtualTable
      return (
        <VirtualDataTableColumnHeader
          column={column}
          title="Name"
          menuItems={[
            {
              id: "group",
              label: <T>Group by Name</T>,
              icon: <LayoutList className="size-4" />,
              onClick: () =>
                virtualTableMeta?.onColumnAction?.("group", column.id),
            },
          ]}
        />
      )
    },
    meta: {
      virtualTable: {
        width: "20rem",
        headerClassName: "max-w-full",
      },
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <VirtualDataTableColumnHeader column={column} title="Status" />
    ),
    meta: {
      virtualTable: {
        width: "10rem",
      },
    },
  },
  {
    accessorKey: "value",
    header: ({ column }) => (
      <VirtualDataTableColumnHeader column={column} title="Value" />
    ),
    cell: ({ row }) => {
      const val = parseFloat(row.getValue("value"))
      return <div className="font-medium tabular-nums">{val.toFixed(2)}</div>
    },
    meta: {
      virtualTable: {
        width: "8rem",
      },
    },
  },
]

export function VirtualTableDemoClient() {
  const data = React.useMemo(() => createMockData(100000), [])

  return (
    <VirtualDataTable
      columns={columns}
      data={data}
      description="Uses window scrolling against 100,000 rows so you can verify the virtualizer without an inner scroll container."
      scrollMode="window"
      onColumnAction={(actionId, columnId) => {
        console.log(`Action ${actionId} triggered on column ${columnId}`)
        alert(`Column action: ${actionId} on ${columnId}`)
      }}
    />
  )
}
