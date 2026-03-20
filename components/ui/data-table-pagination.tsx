"use client"

import type { Table } from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { T } from "gt-next";

interface DataTablePaginationProps<TData> {
  table: Table<TData>
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <div>
        {table.getFilteredRowModel().rows.length}  <T>item</T>
                      {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
      </div>
      <div className="flex items-center gap-2">
        <div className="mr-2">
          
                            <T>Page</T> {table.getState().pagination.pageIndex + 1}  <T>of</T>{" "}
          {table.getPageCount() || 1}
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronsLeft className="size-4" />
          <span className="sr-only"><T>First page</T></span>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="size-4" />
          <span className="sr-only"><T>Previous page</T></span>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight className="size-4" />
          <span className="sr-only"><T>Next page</T></span>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <ChevronsRight className="size-4" />
          <span className="sr-only"><T>Last page</T></span>
        </Button>
      </div>
    </div>
  )
}
