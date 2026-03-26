import assert from "node:assert/strict"
import test from "node:test"
import type { Column, Row, Table } from "@tanstack/react-table"

import { formSubmissionColumns } from "@/app/[locale]/dashboard/trackables/[id]/form-submission-columns"
import {
  getUsageEventColumns,
  resolveUsageEventVisibleColumns,
} from "@/app/[locale]/dashboard/trackables/[id]/usage-event-columns"
import type {
  SubmissionRow,
  UsageEventRow,
} from "@/app/[locale]/dashboard/trackables/[id]/table-types"
import {
  buildTableExportFileName,
  buildTableExportPayload,
  CsvTableExportFormatter,
  getDataTableExportRows,
  getVirtualTableExportRows,
} from "@/lib/table-export"
import { createUsageEventComputedColumnId } from "@/lib/usage-event-search"

test("CsvTableExportFormatter escapes commas, quotes, and newlines", () => {
  const formatter = new CsvTableExportFormatter()
  const artifact = formatter.formatPayload({
    fileName: "test.csv",
    columns: [
      { id: "name", label: "Name" },
      { id: "notes", label: "Notes" },
    ],
    rows: [
      { values: ['Ada "Lovelace"', "line one\nline two"] },
      { values: ["Grace, Hopper", "—"] },
    ],
  })

  assert.equal(artifact.fileName, "test.csv")
  assert.equal(artifact.contentType, "text/csv;charset=utf-8")
  assert.equal(
    artifact.content,
    [
      "Name,Notes",
      '"Ada ""Lovelace""","line one\nline two"',
      '"Grace, Hopper",—',
    ].join("\n")
  )
})

test("buildTableExportFileName normalizes names and appends the current date", () => {
  assert.equal(
    buildTableExportFileName(
      "My Survey Results",
      "survey-data",
      new Date("2026-03-24T12:00:00Z")
    ),
    "my-survey-results-survey-data-2026-03-24.csv"
  )
})

test("buildTableExportPayload uses visible columns and export metadata", () => {
  type ExportRow = {
    submitter: string
    source: string
    createdAt: string
    hidden: string
  }

  const table = {
    getVisibleLeafColumns: () =>
      [
        {
          id: "submitter",
          columnDef: {
            meta: {
              export: {
                label: "Submitter",
                getValue: ({ row }: { row: ExportRow }) =>
                  `${row.submitter}\n${row.source}`,
              },
            },
          },
        },
        {
          id: "createdAt",
          columnDef: {
            meta: {
              export: {
                label: "Submitted",
                getValue: ({ row }: { row: ExportRow }) => row.createdAt,
              },
            },
          },
        },
      ] as unknown as Column<ExportRow, unknown>[],
  } as unknown as Table<ExportRow>
  const rows = [
    {
      original: {
        submitter: "Ada",
        source: "Public link",
        createdAt: "Mar 24 12:34:56.789",
        hidden: "ignored",
      },
      getValue: (columnId: string) =>
        ({
          submitter: "Ada",
          createdAt: "Mar 24 12:34:56.789",
        })[columnId],
    },
  ] as Row<ExportRow>[]

  assert.deepEqual(
    buildTableExportPayload({
      table,
      rows,
      fileName: "survey.csv",
    }),
    {
      fileName: "survey.csv",
      columns: [
        { id: "submitter", label: "Submitter" },
        { id: "createdAt", label: "Submitted" },
      ],
      rows: [
        {
          values: ["Ada\nPublic link", "Mar 24 12:34:56.789"],
        },
      ],
    }
  )
})

test("getDataTableExportRows uses the pre-pagination row model", () => {
  const pagedRows = [{ id: "page" }] as Row<{ id: string }>[]
  const allRows = [{ id: "all" }] as Row<{ id: string }>[]
  const table = {
    getRowModel: () => ({ rows: pagedRows }),
    getPrePaginationRowModel: () => ({ rows: allRows }),
  } as Table<{ id: string }>

  assert.equal(getDataTableExportRows(table), allRows)
})

test("getVirtualTableExportRows uses the full row model", () => {
  const rows = [{ id: "visible" }] as Row<{ id: string }>[]
  const table = {
    getRowModel: () => ({ rows }),
  } as Table<{ id: string }>

  assert.equal(getVirtualTableExportRows(table), rows)
})

test("formSubmissionColumns export the same submitter and submitted text shown in the table", () => {
  const submissionRow: SubmissionRow = {
    id: "submission-1",
    createdAt: "2026-03-24T12:34:56.789-05:00",
    source: "public_link",
    submitterLabel: "Ada Lovelace",
    metadata: null,
    submissionSnapshot: {
      form: {
        id: "form-1",
        version: 1,
        title: "Feedback",
        description: null,
        status: "published",
        submitLabel: null,
        successMessage: null,
        fields: [],
      },
      answers: [],
    },
  }

  const submitterExport = formSubmissionColumns[0]?.meta?.export?.getValue?.({
    row: submissionRow,
    columnId: "submitterLabel",
    value: submissionRow.submitterLabel,
  })
  const submittedExport = formSubmissionColumns[1]?.meta?.export?.getValue?.({
    row: submissionRow,
    columnId: "createdAt",
    value: submissionRow.createdAt,
  })

  assert.equal(submitterExport, "Ada Lovelace\nPublic link")
  assert.equal(submittedExport, "Mar 24, 12:34 pm")
})

test("getUsageEventColumns exports the rendered event table text", () => {
  const sampleRow: UsageEventRow = {
    id: "event-1",
    event: "signup completed",
    level: "info",
    message: null,
    aggregation: "none",
    groupField: null,
    totalHits: 12,
    lastOccurredAt: "2026-03-24T12:34:56.789Z",
    firstOccurredAt: "2026-03-24T01:02:03.004Z",
    percentage: 12.5,
    apiKey: null,
    apiKeyCount: 0,
    apiKeys: [],
    hits: [],
  }
  const columns = getUsageEventColumns([
    { id: "event", label: "Event", visible: true },
    { id: "level", label: "Level", visible: true },
    { id: "message", label: "Message", visible: true },
    { id: "percentage", label: "%", visible: true },
  ])

  const eventExport = columns[0]?.meta?.export?.getValue?.({
    row: sampleRow,
    columnId: "event",
    value: sampleRow.event ?? "",
  })
  const levelExport = columns[1]?.meta?.export?.getValue?.({
    row: sampleRow,
    columnId: "level",
    value: sampleRow.level ?? "",
  })
  const messageExport = columns[2]?.meta?.export?.getValue?.({
    row: sampleRow,
    columnId: "message",
    value: sampleRow.message ?? "",
  })
  const percentageExport = columns[3]?.meta?.export?.getValue?.({
    row: sampleRow,
    columnId: "percentage",
    value: sampleRow.percentage,
  })

  assert.equal(eventExport, "signup")
  assert.equal(levelExport, "Info")
  assert.equal(messageExport, "—")
  assert.equal(percentageExport, "12.5%")
})

test("getUsageEventColumns exports computed payload columns in the visible order", () => {
  const sampleRow: UsageEventRow = {
    id: "event-2",
    event: "page_view",
    level: "info",
    message: "Viewed pricing page",
    aggregation: "none",
    groupField: null,
    totalHits: 1,
    lastOccurredAt: "2026-03-24T12:34:56.789Z",
    firstOccurredAt: "2026-03-24T12:34:56.789Z",
    percentage: 100,
    apiKey: null,
    apiKeyCount: 0,
    apiKeys: [],
    hits: [
      {
        id: "hit-1",
        occurredAt: "2026-03-24T12:34:56.789Z",
        payload: {
          route: "/pricing",
        },
        metadata: null,
        apiKey: {
          id: "123e4567-e89b-42d3-a456-426614174000",
          name: "Primary",
          maskedKey: "trk...1234",
        },
      },
    ],
  }
  const columns = getUsageEventColumns([
    { id: "event", label: "Event", visible: true },
    {
      id: createUsageEventComputedColumnId("route"),
      kind: "computed",
      field: "route",
      label: "Route",
      visible: true,
    },
  ])

  const eventExport = columns[0]?.meta?.export?.getValue?.({
    row: sampleRow,
    columnId: "event",
    value: sampleRow.event ?? "",
  })
  const routeExport = columns[1]?.meta?.export?.getValue?.({
    row: sampleRow,
    columnId: createUsageEventComputedColumnId("route"),
    value: "/pricing",
  })

  assert.equal(eventExport, "page_view")
  assert.equal(routeExport, "/pricing")
})

test("resolveUsageEventVisibleColumns falls back to current default built-ins for a different table mode", () => {
  const groupedColumns = resolveUsageEventVisibleColumns(
    [
      { id: "event", label: "Plan", visible: true },
      { id: "totalHits", label: "Hits", visible: true },
      { id: "lastOccurredAt", label: "Last Seen", visible: true },
    ],
    ["message", createUsageEventComputedColumnId("route")]
  )

  assert.deepEqual(
    groupedColumns.map((column) => column.id),
    [
      "event",
      "totalHits",
      "lastOccurredAt",
      createUsageEventComputedColumnId("route"),
    ]
  )
})
