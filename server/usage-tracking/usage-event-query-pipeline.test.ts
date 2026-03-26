import assert from "node:assert/strict"
import test from "node:test"

import type {
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
} from "@/lib/usage-event-search"
import { UsageEventQueryPipeline } from "@/server/usage-tracking/usage-event-query-pipeline"
import {
  normalizeDateValue,
  quoteSqlStringLiteral,
} from "@/server/usage-tracking/usage-event-query.shared"
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
    limit: 50,
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
    metadata: null,
    apiKey: {
      id: "223e4567-e89b-42d3-a456-426614174000",
      name: "Primary key",
      maskedKey: "trk_test...1234",
    },
  }
}

class FakeUsageEventSqlRepository implements UsageEventSqlRepositoryContract {
  constructor(
    private readonly state: {
      availablePayloads?: Array<Record<string, unknown>>
      countFlatRows?: number
      flatRows?: UsageEventRecord[]
      groupedRows?: {
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
      payloads:
        this.state.availablePayloads ??
        this.state.flatRows?.map((row) => row.payload) ??
        [],
    }
  }

  async fetchFlatRows(
    plan: UsageEventExecutionPlan,
    options?: { limit?: number }
  ) {
    void plan
    const rows = this.state.flatRows ?? []

    return {
      rows:
        typeof options?.limit === "number" ? rows.slice(0, options.limit) : rows,
    }
  }

  async fetchGroupedRows(
    plan: UsageEventExecutionPlan,
    options?: { limit?: number }
  ) {
    void plan
    const groupedRows = this.state.groupedRows ?? {
      rows: [],
      totalGroupedRows: 0,
      totalMatchedEvents: 0,
    }

    return {
      ...groupedRows,
      rows:
        typeof options?.limit === "number"
          ? groupedRows.rows.slice(0, options.limit)
          : groupedRows.rows,
    }
  }
}

test("UsageEventQueryPipeline marks flat SQL results as overflow only after final filtering", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      countFlatRows: 1_001,
      flatRows: [createEvent(0, { event: "signup" })],
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      query: "event:signup",
    }),
    createSourceSnapshot()
  )

  assert.equal(result.maxLogsFound, true)
  assert.equal(result.partialResults, false)
  assert.equal(result.totalMatchedEvents, 1_001)
  assert.equal(result.rows.length, 1)
})

test("UsageEventQueryPipeline keeps fallback results exact after in-memory filtering", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      flatRows: [
        createEvent(0, { event: "signup", route: "/billing" }),
        createEvent(1, { event: "signup", route: "/settings" }),
      ],
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      query: "event:signup AND route:/billing/",
    }),
    createSourceSnapshot()
  )

  assert.equal(result.maxLogsFound, false)
  assert.equal(result.partialResults, true)
  assert.equal(result.totalMatchedEvents, 1)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0]?.event, "signup")
})

test("UsageEventQueryPipeline reports exact grouped fallback totals after regex filtering", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      flatRows: [
        createEvent(0, { event: "signup", route: "/billing" }),
        createEvent(1, { event: "signup", route: "/billing" }),
        createEvent(2, { event: "signup", route: "/settings" }),
      ],
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      aggregation: "payload_field",
      aggregateField: "route",
      query: "event:signup AND route:/billing/",
    }),
    createSourceSnapshot()
  )

  assert.equal(result.partialResults, true)
  assert.equal(result.totalMatchedEvents, 2)
  assert.equal(result.totalGroupedRows, 1)
  assert.equal(result.rows[0]?.event, "/billing")
  assert.equal(result.rows[0]?.totalHits, 2)
  assert.equal(result.rows[0]?.percentage, 100)
})

test("UsageEventQueryPipeline applies the row cap to grouped final output", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      availablePayloads: [{ route: "/billing" }],
      groupedRows: {
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
            id: "route:/billing",
            lastOccurredAt: new Date("2026-03-26T10:00:00.000Z"),
            totalHits: 2,
          },
        ],
        totalGroupedRows: 1_001,
        totalMatchedEvents: 2_500,
      },
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      aggregation: "payload_field",
      aggregateField: "route",
    }),
    createSourceSnapshot()
  )

  assert.equal(result.maxLogsFound, true)
  assert.equal(result.partialResults, false)
  assert.equal(result.totalGroupedRows, 1_001)
  assert.equal(result.totalMatchedEvents, 2_500)
})

test("UsageEventQueryPipeline preserves grouped sort by total hits", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      groupedRows: {
        rows: [
          {
            apiKeys: [],
            firstOccurredAt: new Date("2026-03-26T07:00:00.000Z"),
            groupValue: "/settings",
            id: "route:/settings",
            lastOccurredAt: new Date("2026-03-26T08:00:00.000Z"),
            totalHits: 2,
          },
          {
            apiKeys: [],
            firstOccurredAt: new Date("2026-03-26T09:00:00.000Z"),
            groupValue: "/billing",
            id: "route:/billing",
            lastOccurredAt: new Date("2026-03-26T10:00:00.000Z"),
            totalHits: 5,
          },
        ],
        totalGroupedRows: 2,
        totalMatchedEvents: 7,
      },
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      aggregation: "payload_field",
      aggregateField: "route",
      sort: "totalHits",
      dir: "desc",
    }),
    createSourceSnapshot()
  )

  assert.equal(result.rows[0]?.event, "/billing")
  assert.equal(result.rows[0]?.totalHits, 5)
  assert.equal(result.rows[0]?.percentage, 71.4)
  assert.equal(result.rows[1]?.percentage, 28.6)
})

test("UsageEventQueryPipeline keeps grouped rows with null aggregate values", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      groupedRows: {
        rows: [
          {
            apiKeys: [],
            firstOccurredAt: new Date("2026-03-26T09:00:00.000Z"),
            groupValue: null,
            id: "event:__empty__",
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
  assert.equal(result.rows[0]?.id, "event:__empty__")
})

test("UsageEventQueryPipeline sorts flat rows by event name", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      countFlatRows: 2,
      flatRows: [
        createEvent(0, { event: "signup" }),
        createEvent(1, { event: "billing" }),
      ],
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      query: "",
      sort: "event",
      dir: "asc",
    }),
    createSourceSnapshot()
  )

  assert.equal(result.partialResults, false)
  assert.equal(result.rows[0]?.event, "billing")
  assert.equal(result.rows[1]?.event, "signup")
})

test("UsageEventQueryPipeline trims visible flat rows to the requested limit while keeping exact totals", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      countFlatRows: 3,
      flatRows: [
        createEvent(0, { event: "alpha" }),
        createEvent(1, { event: "beta" }),
        createEvent(2, { event: "gamma" }),
      ],
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      limit: 2,
    }),
    createSourceSnapshot()
  )

  assert.equal(result.rows.length, 2)
  assert.equal(result.totalMatchedEvents, 3)
  assert.equal(result.totalGroupedRows, 3)
})

test("UsageEventQueryPipeline derives aggregate fields from the final fallback-filtered payloads", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      flatRows: [
        createEvent(0, { event: "signup", route: "/billing", level: "info" }),
        createEvent(1, { event: "signup", feature: "beta" }),
      ],
    })
  )

  const result = await pipeline.execute(
    createSearchInput({
      query: "route:/billing/",
    }),
    createSourceSnapshot()
  )

  assert.deepEqual(result.availableAggregateFields, ["event", "level", "route"])
})

test("UsageEventQueryPipeline keeps aggregate fields from SQL-visible payloads in grouped SQL mode", async () => {
  const pipeline = new UsageEventQueryPipeline(
    undefined,
    undefined,
    new FakeUsageEventSqlRepository({
      availablePayloads: [
        { event: "signup", route: "/billing" },
        { event: "login", level: "info" },
      ],
      groupedRows: {
        rows: [
          {
            apiKeys: [],
            firstOccurredAt: new Date("2026-03-26T09:00:00.000Z"),
            groupValue: "signup",
            id: "event:signup",
            lastOccurredAt: new Date("2026-03-26T10:00:00.000Z"),
            totalHits: 2,
          },
        ],
        totalGroupedRows: 1,
        totalMatchedEvents: 2,
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

  assert.deepEqual(result.availableAggregateFields, ["event", "level", "route"])
})

test("quoteSqlStringLiteral escapes payload keys for raw grouped SQL", () => {
  assert.equal(quoteSqlStringLiteral("event"), "'event'")
  assert.equal(quoteSqlStringLiteral("user'name"), "'user''name'")
})

test("normalizeDateValue converts aggregate timestamp strings to Date", () => {
  const normalized = normalizeDateValue("2026-03-26T10:00:00.000Z")

  assert.ok(normalized instanceof Date)
  assert.equal(normalized.toISOString(), "2026-03-26T10:00:00.000Z")
})
