"use client"

import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { TableExportButton } from "@/components/ui/table-export-button"
import { DataTableViewOptions } from "@/components/ui/data-table-view-options"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import * as React from "react"
import {
  getDataTableExportRows,
  type TableExportOptions,
} from "@/lib/table-export"
import { useGT } from "gt-next"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  title?: React.ReactNode
  titleVariant?: "default" | "page"
  description?: React.ReactNode
  onRowClick?: (row: TData) => void
  emptyMessage?: string
  headerButton?: React.ReactNode
  exportOptions?: TableExportOptions
  showViewOptions?: boolean
  initialPageSize?: number
  fillHeight?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  title,
  titleVariant = "default",
  description,
  onRowClick,
  emptyMessage,
  headerButton,
  exportOptions,
  showViewOptions = true,
  initialPageSize = 5,
  fillHeight = false,
}: DataTableProps<TData, TValue>) {
  const gt = useGT()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: initialPageSize,
      },
    },
  })

  return (
    <div
      className={cn(
        "min-w-0 space-y-4",
        fillHeight ? "flex h-full min-h-0 flex-col" : undefined
      )}
    >
      {(title || description || headerButton || exportOptions) && (
        <div className="flex flex-col gap-4 px-1 pt-3">
          <div className="flex items-end justify-between gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col justify-start gap-1">
              {title ? (
                <h3
                  className={cn(
                    titleVariant === "page"
                      ? "text-3xl font-semibold tracking-tight"
                      : "text-lg font-semibold"
                  )}
                >
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <div className="flex items-end space-x-2">
              {headerButton}
              {exportOptions ? (
                <TableExportButton
                  table={table}
                  rows={getDataTableExportRows(table)}
                  fileName={exportOptions.fileName}
                  format={exportOptions.format}
                />
              ) : null}
              {showViewOptions ? <DataTableViewOptions table={table} /> : null}
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "max-w-full min-w-0 rounded-md border",
          fillHeight ? "flex-1 overflow-auto" : undefined
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    onRowClick
                      ? "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      : undefined
                  )}
                  onClick={() => onRowClick?.(row.original)}
                  onKeyDown={(event) => {
                    if (!onRowClick) {
                      return
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onRowClick(row.original)
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage ?? gt("No results.")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  )
}
