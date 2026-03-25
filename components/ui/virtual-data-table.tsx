"use client"

import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  type Column,
  type ColumnSizingState,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Header,
  type Row,
  getSortedRowModel,
  type RowData,
  type SortingState,
  type Table,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual"
import * as React from "react"
import { TableExportButton } from "@/components/ui/table-export-button"
import {
  getVirtualTableExportRows,
  type TableExportOptions,
} from "@/lib/table-export"

export type VirtualTableColumnAction = {
  id: string
  label: React.ReactNode
  icon?: React.ReactNode
  separator?: boolean
}

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    virtualTable?: {
      width?: React.CSSProperties["width"]
      minWidth?: React.CSSProperties["minWidth"]
      maxWidth?: React.CSSProperties["maxWidth"]
      headerClassName?: string
      cellClassName?: string
    }
  }

  interface TableMeta<TData extends RowData> {
    virtualTable?: {
      onColumnAction?: (actionId: string, columnId: string) => void
      globalColumnActions?: VirtualTableColumnAction[]
      columnActions?: Record<string, VirtualTableColumnAction[]>
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export interface VirtualDataTableClassNames {
  root?: string
  headerArea?: string // Wraps title, description, headerButton
  tableContainer?: string // Scroll container
  table?: string
  header?: string
  body?: string
  row?: string
  cell?: string
}

interface VirtualDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  title?: React.ReactNode
  titleVariant?: "default" | "page"
  description?: React.ReactNode
  footer?: React.ReactNode
  onRowClick?: (row: TData) => void
  emptyMessage?: string
  headerButton?: React.ReactNode
  exportOptions?: TableExportOptions

  // Styling
  className?: string // Root className
  classNames?: VirtualDataTableClassNames

  // Virtualization config
  scrollMode?: "container" | "window"
  estimateRowHeight?: number
  overscan?: number

  // Column actions
  onColumnAction?: (actionId: string, columnId: string) => void
  globalColumnActions?: VirtualTableColumnAction[]
  columnActions?: Record<string, VirtualTableColumnAction[]>

  // Sticky header
  stickyHeader?: boolean

  // Column sizing
  enableColumnResizing?: boolean
}

export function VirtualDataTable<TData, TValue>({
  columns,
  data,
  title,
  titleVariant = "default",
  description,
  footer,
  onRowClick,
  emptyMessage = "No results.",
  headerButton,
  exportOptions,
  className,
  classNames,
  scrollMode = "container",
  estimateRowHeight = 44,
  overscan = 10,
  onColumnAction,
  globalColumnActions,
  columnActions,
  stickyHeader = true,
  enableColumnResizing = false,
}: VirtualDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing,
    columnResizeMode: enableColumnResizing ? "onChange" : undefined,
    defaultColumn: {
      minSize: 16,
    },
    state: {
      sorting,
      columnVisibility,
      columnSizing,
    },
    meta: {
      virtualTable: {
        onColumnAction,
        globalColumnActions,
        columnActions,
      },
    },
  })

  const { rows } = table.getRowModel()
  const visibleColumnCount = table.getVisibleLeafColumns().length
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const usesWindowScroll = scrollMode === "window"
  const wrapperClassName =
    "min-h-0 overflow-hidden rounded-xl border border-border/40 bg-card"
  const containerClassName = usesWindowScroll
    ? "relative min-h-0 max-w-full min-w-0 overflow-x-auto overflow-y-visible [overflow-anchor:none]"
    : "relative min-h-0 max-w-full min-w-0 overflow-auto [overflow-anchor:none]"

  return (
    <div
      className={cn(
        "flex min-h-0 max-w-full min-w-0 flex-col gap-4",
        className
      )}
    >
      {(title || description || headerButton || exportOptions) && (
        <div
          className={cn(
            "flex items-end justify-between gap-3",
            classNames?.headerArea
          )}
        >
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
                rows={getVirtualTableExportRows(table)}
                fileName={exportOptions.fileName}
                format={exportOptions.format}
              />
            ) : null}
          </div>
        </div>
      )}

      <div className={cn(wrapperClassName)}>
        <div
          ref={scrollContainerRef}
          className={cn(containerClassName, classNames?.tableContainer)}
        >
          {usesWindowScroll ? (
            <WindowVirtualTable
              table={table}
              rows={rows}
              visibleColumnCount={visibleColumnCount}
              scrollContainerRef={scrollContainerRef}
              estimateRowHeight={estimateRowHeight}
              overscan={overscan}
              onRowClick={onRowClick}
              emptyMessage={emptyMessage}
              stickyHeader={stickyHeader}
              classNames={classNames}
              enableColumnResizing={enableColumnResizing}
            />
          ) : (
            <ContainerVirtualTable
              table={table}
              rows={rows}
              visibleColumnCount={visibleColumnCount}
              scrollContainerRef={scrollContainerRef}
              estimateRowHeight={estimateRowHeight}
              overscan={overscan}
              onRowClick={onRowClick}
              emptyMessage={emptyMessage}
              stickyHeader={stickyHeader}
              classNames={classNames}
              enableColumnResizing={enableColumnResizing}
            />
          )}
        </div>
        {footer ? (
          <div className="border-t border-border/40 px-6 py-3 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface VirtualizedTableContentProps<TData> {
  table: Table<TData>
  rows: Row<TData>[]
  virtualItems: Array<{ index: number; start: number; end: number }>
  totalSize: number
  visibleColumnCount: number
  onRowClick?: (row: TData) => void
  emptyMessage: string
  stickyHeader: boolean
  estimateRowHeight: number
  classNames?: VirtualDataTableClassNames
  enableColumnResizing: boolean
}

function ContainerVirtualTable<TData>({
  table,
  rows,
  visibleColumnCount,
  scrollContainerRef,
  estimateRowHeight,
  overscan,
  onRowClick,
  emptyMessage,
  stickyHeader,
  classNames,
  enableColumnResizing,
}: {
  table: Table<TData>
  rows: Row<TData>[]
  visibleColumnCount: number
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  estimateRowHeight: number
  overscan: number
  onRowClick?: (row: TData) => void
  emptyMessage: string
  stickyHeader: boolean
  classNames?: VirtualDataTableClassNames
  enableColumnResizing: boolean
}) {
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  })

  return (
    <VirtualizedTableContent
      table={table}
      rows={rows}
      virtualItems={rowVirtualizer.getVirtualItems()}
      totalSize={rowVirtualizer.getTotalSize()}
      visibleColumnCount={visibleColumnCount}
      onRowClick={onRowClick}
      emptyMessage={emptyMessage}
      stickyHeader={stickyHeader}
      estimateRowHeight={estimateRowHeight}
      classNames={classNames}
      enableColumnResizing={enableColumnResizing}
    />
  )
}

function WindowVirtualTable<TData>({
  table,
  rows,
  visibleColumnCount,
  scrollContainerRef,
  estimateRowHeight,
  overscan,
  onRowClick,
  emptyMessage,
  stickyHeader,
  classNames,
  enableColumnResizing,
}: {
  table: Table<TData>
  rows: Row<TData>[]
  visibleColumnCount: number
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  estimateRowHeight: number
  overscan: number
  onRowClick?: (row: TData) => void
  emptyMessage: string
  stickyHeader: boolean
  classNames?: VirtualDataTableClassNames
  enableColumnResizing: boolean
}) {
  const scrollMargin = useDocumentOffsetTop(scrollContainerRef)
  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimateRowHeight,
    overscan,
    scrollMargin,
  })

  return (
    <VirtualizedTableContent
      table={table}
      rows={rows}
      virtualItems={rowVirtualizer.getVirtualItems()}
      totalSize={rowVirtualizer.getTotalSize()}
      visibleColumnCount={visibleColumnCount}
      onRowClick={onRowClick}
      emptyMessage={emptyMessage}
      stickyHeader={stickyHeader}
      estimateRowHeight={estimateRowHeight}
      classNames={classNames}
      enableColumnResizing={enableColumnResizing}
    />
  )
}

function VirtualizedTableContent<TData>({
  table,
  rows,
  virtualItems,
  totalSize,
  visibleColumnCount,
  onRowClick,
  emptyMessage,
  stickyHeader,
  estimateRowHeight,
  classNames,
  enableColumnResizing,
}: VirtualizedTableContentProps<TData>) {
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end || 0)
      : 0
  const visibleColumns = table.getVisibleLeafColumns()
  const resizedTableWidth = enableColumnResizing ? table.getTotalSize() : undefined
  const lastVisibleColumnId = visibleColumns[visibleColumns.length - 1]?.id

  return (
    <table
      className={cn(
        "caption-bottom text-sm",
        enableColumnResizing ? "w-full" : "w-max min-w-full",
        enableColumnResizing && "table-fixed",
        classNames?.table
      )}
      style={
        resizedTableWidth
          ? {
              minWidth: `${resizedTableWidth}px`,
            }
          : undefined
      }
    >
      {enableColumnResizing ? (
        <colgroup>
          {visibleColumns.map((column) => (
            <col
              key={column.id}
              style={getColumnWidthStyle(
                column,
                true,
                column.id === lastVisibleColumnId
              )}
            />
          ))}
        </colgroup>
      ) : null}
      <TableHeader
        className={cn(
          stickyHeader && "sticky top-0 z-10 bg-muted/30",
          classNames?.header
        )}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const columnWidthStyle = getColumnWidthStyle(
                header.column,
                enableColumnResizing,
                header.column.id === lastVisibleColumnId
              )
              const columnClassNames = getColumnClassNames(header.column)
              const isFirstColumn = header.index === 0
              const isLastColumn =
                header.index === headerGroup.headers.length - 1

              return (
                <TableHead
                  key={header.id}
                  className={cn(
                    stickyHeader && "bg-muted",
                    enableColumnResizing && "group/resize relative overflow-hidden",
                    isFirstColumn && "pl-6",
                    isLastColumn && "pr-6",
                    columnClassNames.headerClassName
                  )}
                  style={columnWidthStyle}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  {enableColumnResizing &&
                  header.column.getCanResize() &&
                  !header.isPlaceholder ? (
                    <ColumnResizeHandle header={header} />
                  ) : null}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className={classNames?.body}>
        {paddingTop > 0 && (
          <TableRow>
            <TableCell
              colSpan={visibleColumnCount}
              style={{ height: paddingTop, padding: 0, border: 0 }}
            />
          </TableRow>
        )}

        {virtualItems.length ? (
          virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index]
            return (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={cn(
                  onRowClick
                    ? "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    : undefined,
                  classNames?.row
                )}
                onClick={() => onRowClick?.(row.original)}
                onKeyDown={(event) => {
                  if (!onRowClick) return

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onRowClick(row.original)
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {row.getVisibleCells().map((cell, cellIndex) => {
                  const isFirstColumn = cellIndex === 0
                  const isLastColumn =
                    cellIndex === row.getVisibleCells().length - 1

                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "min-w-0 overflow-hidden text-ellipsis",
                        isFirstColumn && "pl-6",
                        isLastColumn && "pr-6",
                        getColumnClassNames(cell.column).cellClassName,
                        classNames?.cell
                      )}
                      style={{
                        height: estimateRowHeight,
                        ...getColumnWidthStyle(
                          cell.column,
                          enableColumnResizing,
                          cell.column.id === lastVisibleColumnId
                        ),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={visibleColumnCount}
              className="h-24 text-center text-muted-foreground"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}

        {paddingBottom > 0 && (
          <TableRow>
            <TableCell
              colSpan={visibleColumnCount}
              style={{ height: paddingBottom, padding: 0, border: 0 }}
            />
          </TableRow>
        )}
      </TableBody>
    </table>
  )
}

function useDocumentOffsetTop(ref: React.RefObject<HTMLElement | null>) {
  const [offsetTop, setOffsetTop] = React.useState(0)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    const updateOffset = () => {
      const nextOffset = element.getBoundingClientRect().top + window.scrollY
      setOffsetTop((currentOffset) =>
        currentOffset === nextOffset ? currentOffset : nextOffset
      )
    }

    updateOffset()

    const resizeObserver = new ResizeObserver(updateOffset)
    resizeObserver.observe(element)
    window.addEventListener("resize", updateOffset)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateOffset)
    }
  }, [ref])

  return offsetTop
}

function getColumnWidthStyle<TData, TValue>(
  column: Column<TData, TValue>,
  useColumnSizing = false,
  isFlexibleLastColumn = false
) {
  if (useColumnSizing) {
    return {
      width: isFlexibleLastColumn ? undefined : `${column.getSize()}px`,
      minWidth: toPixelWidth(column.columnDef.minSize ?? 16),
      maxWidth: toPixelWidth(column.columnDef.maxSize),
    }
  }

  const virtualTableMeta = column.columnDef.meta?.virtualTable

  return {
    width: virtualTableMeta?.width ?? toPixelWidth(column.columnDef.size),
    minWidth:
      virtualTableMeta?.minWidth ?? toPixelWidth(column.columnDef.minSize),
    maxWidth:
      virtualTableMeta?.maxWidth ?? toPixelWidth(column.columnDef.maxSize),
  }
}

function getColumnClassNames<TData, TValue>(column: Column<TData, TValue>) {
  const virtualTableMeta = column.columnDef.meta?.virtualTable

  return {
    headerClassName: virtualTableMeta?.headerClassName,
    cellClassName: virtualTableMeta?.cellClassName,
  }
}

function toPixelWidth(value: number | undefined) {
  return typeof value === "number" ? `${value}px` : undefined
}

function ColumnResizeHandle<TData, TValue>({
  header,
}: {
  header: Header<TData, TValue>
}) {
  const resizeHandler = header.getResizeHandler()

  return (
    <div
      role="presentation"
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex w-3 cursor-col-resize touch-none select-none items-center justify-center",
        header.column.getIsResizing() && "bg-border/10"
      )}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.stopPropagation()
        resizeHandler(event)
      }}
      onTouchStart={(event) => {
        event.stopPropagation()
        resizeHandler(event)
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-4 w-px rounded-full bg-border/40 transition-colors group-hover/resize:bg-border/70",
          header.column.getIsResizing() && "h-5 bg-foreground/60"
        )}
      />
    </div>
  )
}
