import assert from "node:assert/strict"
import test from "node:test"

import type {
  UsageEventTableData,
  UsageEventRow,
} from "@/app/[locale]/dashboard/trackables/[id]/table-types"
import { mergeUsageEventTablePages } from "@/app/[locale]/dashboard/trackables/[id]/usage-event-table-data"

function createRow(id: string): UsageEventRow {
  return {
    apiKey: {
      id: `api-key-${id}`,
      maskedKey: `trk_test...${id.slice(-4)}`,
      name: `API key ${id}`,
    },
    hits: [
      {
        apiKey: {
          id: `api-key-${id}`,
          maskedKey: `trk_test...${id.slice(-4)}`,
          name: `API key ${id}`,
        },
        id,
        metadata: null,
        occurredAt: "2026-03-31T00:00:00.000Z",
        payload: {
          event: `event-${id}`,
        },
      },
    ],
    aggregation: "none",
    apiKeyCount: 1,
    apiKeys: [
      {
        id: `api-key-${id}`,
        maskedKey: `trk_test...${id.slice(-4)}`,
        name: `API key ${id}`,
      },
    ],
    event: `event-${id}`,
    firstOccurredAt: "2026-03-31T00:00:00.000Z",
    groupField: null,
    id,
    lastOccurredAt: "2026-03-31T00:00:00.000Z",
    level: null,
    message: null,
    percentage: 100,
    totalHits: 1,
  }
}

function createPage(
  overrides: Partial<UsageEventTableData> = {}
): UsageEventTableData {
  return {
    availableAggregateFields: ["event"],
    columns: [],
    hasMore: false,
    nextCursor: null,
    rows: [],
    sourceSnapshot: {
      latestOccurredAt: "2026-03-31T00:00:00.000Z",
      totalEventCount: 3,
    },
    totalGroupedRows: 3,
    totalMatchedEvents: 3,
    ...overrides,
  }
}

test("mergeUsageEventTablePages returns null without pages", () => {
  assert.equal(mergeUsageEventTablePages(undefined), null)
})

test("mergeUsageEventTablePages keeps final-page pagination state and deduplicates rows", () => {
  const merged = mergeUsageEventTablePages([
    createPage({
      hasMore: true,
      nextCursor: "cursor-1",
      rows: [createRow("row-1"), createRow("row-2")],
    }),
    createPage({
      hasMore: false,
      nextCursor: null,
      rows: [createRow("row-2"), createRow("row-3")],
    }),
  ])

  assert.deepEqual(
    merged?.rows.map((row) => row.id),
    ["row-1", "row-2", "row-3"]
  )
  assert.equal(merged?.hasMore, false)
  assert.equal(merged?.nextCursor, null)
})
