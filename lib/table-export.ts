import type { Column, Row, RowData, Table } from "@tanstack/react-table"

export type TableExportFormat = "csv"

export type TableExportColumn = {
  id: string
  label: string
}

export type TableExportRow = {
  values: string[]
}

export type TableExportPayload = {
  fileName: string
  columns: TableExportColumn[]
  rows: TableExportRow[]
}

export type TableExportArtifact = {
  content: string
  contentType: string
  fileName: string
}

export type TableExportOptions = {
  fileName: string
  format?: TableExportFormat
}

export interface TableExportFormatter {
  readonly format: TableExportFormat
  formatPayload(payload: TableExportPayload): TableExportArtifact
}

export interface FileDownloadService {
  download(artifact: TableExportArtifact): void
}

export class CsvTableExportFormatter implements TableExportFormatter {
  readonly format = "csv" as const

  formatPayload(payload: TableExportPayload): TableExportArtifact {
    const headerRow = payload.columns.map((column) =>
      this.escapeCell(column.label)
    )
    const dataRows = payload.rows.map((row) =>
      row.values.map((value) => this.escapeCell(value))
    )
    const lines = [headerRow, ...dataRows].map((row) => row.join(","))

    return {
      content: lines.join("\n"),
      contentType: "text/csv;charset=utf-8",
      fileName: payload.fileName,
    }
  }

  private escapeCell(value: string) {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`
    }

    return value
  }
}

export class BrowserFileDownloadService implements FileDownloadService {
  download(artifact: TableExportArtifact) {
    const blob = new Blob([artifact.content], {
      type: artifact.contentType,
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = artifact.fileName
    link.click()

    URL.revokeObjectURL(url)
  }
}

export class TableExportService {
  private readonly formatters = new Map<
    TableExportFormat,
    TableExportFormatter
  >()

  constructor(
    formatters: TableExportFormatter[],
    private readonly downloadService: FileDownloadService
  ) {
    for (const formatter of formatters) {
      this.formatters.set(formatter.format, formatter)
    }
  }

  export(payload: TableExportPayload, format: TableExportFormat) {
    const formatter = this.formatters.get(format)

    if (!formatter) {
      throw new Error(`Unsupported export format: ${format}`)
    }

    const artifact = formatter.formatPayload(payload)
    this.downloadService.download(artifact)
  }
}

export function buildTableExportFileName(
  name: string,
  suffix: string,
  date = new Date()
) {
  const normalizedName = slugifySegment(name) || "trackable"
  const normalizedSuffix = slugifySegment(suffix) || "export"
  const isoDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")

  return `${normalizedName}-${normalizedSuffix}-${isoDate}.csv`
}

export function buildTableExportPayload<TData>({
  table,
  rows,
  fileName,
}: {
  table: Table<TData>
  rows: Row<TData>[]
  fileName: string
}): TableExportPayload {
  const columns = table
    .getVisibleLeafColumns()
    .map((column) => buildExportColumnDefinition(column))

  return {
    fileName,
    columns: columns.map(({ id, label }) => ({ id, label })),
    rows: rows.map((row) => ({
      values: columns.map((column) => column.getValue(row)),
    })),
  }
}

export function getDataTableExportRows<TData>(table: Table<TData>) {
  return table.getPrePaginationRowModel().rows
}

export function getVirtualTableExportRows<TData>(table: Table<TData>) {
  return table.getRowModel().rows
}

type ExportColumnDefinition<TData> = {
  id: string
  label: string
  getValue: (row: Row<TData>) => string
}

function buildExportColumnDefinition<TData>(
  column: Column<TData, unknown>
): ExportColumnDefinition<TData> {
  const exportMeta = column.columnDef.meta?.export

  return {
    id: column.id,
    label: exportMeta?.label ?? getColumnLabel(column),
    getValue: (row) => {
      const value =
        exportMeta?.getValue?.({
          row: row.original,
          columnId: column.id,
          value: row.getValue(column.id),
        }) ?? stringifyExportValue(row.getValue(column.id))

      return value
    },
  }
}

function getColumnLabel<TData>(column: Column<TData, unknown>) {
  const header = column.columnDef.header

  if (typeof header === "string") {
    return header
  }

  return column.id
}

function stringifyExportValue(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }

  return JSON.stringify(value)
}

function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    export?: {
      label?: string
      getValue?: (context: {
        row: TData
        columnId: string
        value: TValue
      }) => string
    }
  }
}
