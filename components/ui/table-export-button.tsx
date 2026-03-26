"use client"

import type { Row, Table } from "@tanstack/react-table"
import { Download } from "lucide-react"
import { T, useGT } from "gt-next"

import { Button } from "@/components/ui/button"
import {
  BrowserFileDownloadService,
  buildTableExportPayload,
  CsvTableExportFormatter,
  type TableExportFormat,
  TableExportService,
} from "@/lib/table-export"

const tableExportService = new TableExportService(
  [new CsvTableExportFormatter()],
  new BrowserFileDownloadService()
)

export function TableExportButton<TData>({
  table,
  rows,
  fileName,
  format = "csv",
  buildPayload,
}: {
  table: Table<TData>
  rows: Row<TData>[]
  fileName: string
  format?: TableExportFormat
  buildPayload?: (context: {
    table: Table<TData>
    rows: Row<TData>[]
    fileName: string
  }) => ReturnType<typeof buildTableExportPayload<TData>>
}) {
  const gt = useGT()
  function handleExport() {
    const payload =
      buildPayload?.({
        table,
        rows,
        fileName,
      }) ??
      buildTableExportPayload({
        table,
        rows,
        fileName,
      })

    tableExportService.export(payload, format)
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      aria-label={gt("Export data")}
      title={gt("Export data")}
    >
      <Download />
      <T>Export</T>
    </Button>
  )
}
