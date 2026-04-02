import assert from "node:assert/strict"
import test from "node:test"

import {
  type UsageEventSearchInput,
  type UsageEventSourceSnapshot,
} from "@/lib/usage-event-search"
import { USAGE_EVENT_PAGE_SIZE } from "@/server/usage-tracking/usage-event-config"
import { UsageEventQueryPipeline } from "@/server/usage-tracking/usage-event-query-pipeline"
import type {
  UsageEventExecutionPlan,
  UsageEventGroupedRow,
  UsageEventRecord,
  UsageEventSqlRepositoryContract,
} from "@/server/usage-tracking/usage-event-query.types"

function createSearchInput(
  overrides: Partial<UsageEventSearchInput> = {}
): UsageEventSearchInput {
  return {
    trackableId: "123e4567-e89b-42d3-a456-426614174000",
    query: "",
    aggregation: "none",
    aggregateField: null,
    sort: "lastOccurredAt",
    dir: "desc",
    from: null,
    to: null,
    cursor: null,
    pageSize: USAGE_EVENT_PAGE_SIZE,
    ...overrides,
  }
}

function createSourceSnapshot(): UsageEventSourceSnapshot {
  return {
    totalEventCount: 5_000,
    latestOccurredAt: "2026-03-26T10:00:00.000Z",
  }
}

function createEvent(index: number, payload: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    occurredAt: new Date(Date.UTC(2026, 2, 26, 12, 0, index)),
    payload,
    metadata:
      index === 0 ? { route: "/billing", userAgent: "Mozilla/5.0" } : null,
    apiKey: {
      id: "223e4567-e89b-42d3-a456-426614174000",
      name: "Primary key",
      maskedKey: "trk_test...1234",
    },
  } satisfies UsageEventRecord
}

class FakeUsageEventSqlRepository implements UsageEventSqlRepositoryContract {
  constructor(
    private readonly state: {
      availableFields?: string[]
      countFlatRows?: number
      flatRows?: UsageEventRecord[]
      flatHasMore?: boolean
      flatNextCursor?: string | null
      groupedRows?: {
        hasMore?: boolean
        nextCursor?: string | null
        rows: UsageEventGroupedRow[]
        totalGroupedRows: number
        totalMatchedEvents: number
      }
    }
  ) {}

  async countFlatRows(plan: UsageEventExecutionPlan): Promise<number> {
    void plan
    return this.state.countFlatRows ?? this.state.flatRows?.length ?? 0
  }

  async fetchAvailableAggregateFields(plan: UsageEventExecutionPlan) {
    void plan
    return {
      fields: this.state.availableFields ?? [],
    }
  }

  async fetchFlatRows(plan: UsageEventExecutionPlan) {
    void plan
    return {
      hasMore: this.state.flatHasMore ?? false,
      nextCursor: this.state.flatNextCursor ?? null,
      rows: this.state.flatRows ?? [],
    }
  }

  async fetchGroupedRowsPage(plan: UsageEventExecutionPlan) {
    void plan
    const groupedRows = this.state.groupedRows ?? {
      rows: [],
      totalGroupedRows: 0,
      totalMatchedEvents: 0,
    }

    return {
      hasMore: groupedRows.hasMore ?? false,
      nextCursor: groupedRows.nextCursor ?? null,
      rows: groupedRows.rows,
    }
  }

  async fetchGroupedTotals(plan: UsageEventExecutionPlan) {
    void plan
    const groupedRows = this.state.groupedRows ?? {
      rows: [],
      totalGroupedRows: 0,
      totalMatchedEvents: 0,
    }

    return {
      totalGroupedRows: groupedRows.totalGroupedRows,
      totalMatchedEvents: groupedRows.totalMatchedEvents,
    }
  }
}

test("UsageEventQueryPipeline preserves exact totals and pagination state for flat results", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      availableFields: ["event", "level", "route"],
      countFlatRows: 250,
      flatHasMore: true,
      flatNextCursor: "cursor-2",
      flatRows: [
        createEvent(0, { event: "signup", level: "info", route: "/billing" }),
        createEvent(1, { event: "login", level: "info", route: "/dashboard" }),
      ],
    })
  )

  const result = await pipeline.execute(
    createSearchInput(),
    createSourceSnapshot()
  )

  assert.equal(result.totalMatchedEvents, 250)
  assert.equal(result.totalGroupedRows, 250)
  assert.equal(result.hasMore, true)
  assert.equal(result.nextCursor, "cursor-2")
  assert.deepEqual(result.availableAggregateFields, ["event", "level", "route"])
  assert.deepEqual(result.rows[0]?.hits[0]?.metadata, {
    route: "/billing",
    userAgent: "Mozilla/5.0",
  })
})

test("UsageEventQueryPipeline preserves grouped totals and percentages without client-side trimming", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      availableFields: ["event", "route"],
      groupedRows: {
        hasMore: true,
        nextCursor: "group-cursor-2",
        rows: [
          {
            apiKeys: [
              {
                id: "223e4567-e89b-42d3-a456-426614174000",
                maskedKey: "trk_test...1234",
                name: "Primary key",
              },
            ],
            firstOccurredAt: new Date("2026-03-26T09:00:00.000Z"),
            groupValue: "/billing",
            id: 'route:"/billing"',
            lastOccurredAt: new Date("2026-03-26T10:00:00.000Z"),
            totalHits: 7,
          },
        ],
        totalGroupedRows: 42,
        totalMatchedEvents: 10,
      },
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      aggregation: "payload_field",
      aggregateField: "route",
      sort: "totalHits",
    }),
    createSourceSnapshot()
  )

  assert.equal(result.totalGroupedRows, 42)
  assert.equal(result.totalMatchedEvents, 10)
  assert.equal(result.hasMore, true)
  assert.equal(result.nextCursor, "group-cursor-2")
  assert.equal(result.rows[0]?.event, "/billing")
  assert.equal(result.rows[0]?.totalHits, 7)
  assert.equal(result.rows[0]?.percentage, 70)
})

test("UsageEventQueryPipeline keeps grouped rows with null aggregate values", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      availableFields: ["event"],
      groupedRows: {
        rows: [
          {
            apiKeys: [],
            firstOccurredAt: new Date("2026-03-26T09:00:00.000Z"),
            groupValue: null,
            id: "event:__missing__",
            lastOccurredAt: new Date("2026-03-26T10:00:00.000Z"),
            totalHits: 3,
          },
        ],
        totalGroupedRows: 1,
        totalMatchedEvents: 3,
      },
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      aggregation: "payload_field",
      aggregateField: "event",
    }),
    createSourceSnapshot()
  )

  assert.equal(result.rows[0]?.event, null)
  assert.equal(result.rows[0]?.id, "event:__missing__")
})
