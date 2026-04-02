import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import test from "node:test"

import type { SQLWrapper } from "drizzle-orm"
import { newDb } from "pg-mem"

import { type UsageEventSearchInput } from "@/lib/usage-event-search"
import { USAGE_EVENT_PAGE_SIZE } from "@/server/usage-tracking/usage-event-config"
import { UsageEventQueryPlanner } from "@/server/usage-tracking/usage-event-query-planner"
import { UsageEventSearchParser } from "@/server/usage-tracking/usage-event-search-parser"
import { UsageEventSqlRepository } from "@/server/usage-tracking/usage-event-sql-repository"

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

class FakeRawSqlDatabase {
  readonly sql: string[] = []

  constructor(private readonly queuedRows: Array<Record<string, unknown>[]>) {}

  async execute(query: SQLWrapper) {
    const sqlText =
      typeof (query as { toSQL?: () => { sql: string } }).toSQL === "function"
        ? (query as unknown as { toSQL: () => { sql: string } }).toSQL().sql
        : ""

    this.sql.push(sqlText)

    const rows = this.queuedRows.shift()

    if (!rows) {
      throw new Error("No queued rows available for fake SQL database.")
    }

    return { rows }
  }
}

async function createPgMemUsageEventDatabase() {
  const db = newDb()
  db.public.registerOperator({
    operator: "~",
    left: "text",
    right: "text",
    returns: "bool",
    implementation: (value: string, pattern: string) => {
      const match = /^\(\?([imsx]+)\)(.*)$/s.exec(pattern)
      const flags = match?.[1].replaceAll("x", "") ?? ""
      const source = match?.[2] ?? pattern

      return new RegExp(source, flags).test(value)
    },
  })
  const { Client } = db.adapters.createPg()
  const client = new Client()

  await client.connect()
  await client.query(`
    create table api_keys(
      id uuid primary key,
      last_four text not null,
      name text not null,
      key_prefix text not null
    );
    create table trackable_api_usage_events(
      id uuid primary key,
      trackable_id uuid not null,
      api_key_id uuid not null,
      occurred_at timestamptz not null,
      payload jsonb not null,
      metadata jsonb
    );
  `)

  return client
}

test("UsageEventSqlRepository fetchFlatRows only returns a cursor when another page exists", async () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()
  const fakeDb = new FakeRawSqlDatabase([
    [
      {
        api_key_id: "223e4567-e89b-42d3-a456-426614174000",
        api_key_last_four: "1234",
        api_key_name: "Primary key",
        api_key_prefix: "trk_test",
        id: "00000000-0000-4000-8000-000000000001",
        metadata: { clientId: "abc-1" },
        occurred_at: "2026-03-31T00:00:00.000Z",
        payload: { event: "log", level: "info" },
        sort_value: "log",
      },
      {
        api_key_id: "223e4567-e89b-42d3-a456-426614174000",
        api_key_last_four: "1234",
        api_key_name: "Primary key",
        api_key_prefix: "trk_test",
        id: "00000000-0000-4000-8000-000000000002",
        metadata: { clientId: "abc-2" },
        occurred_at: "2026-03-31T00:01:00.000Z",
        payload: { event: "warn", level: "warn" },
        sort_value: "warn",
      },
    ],
  ])
  const repository = new UsageEventSqlRepository(fakeDb)
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: "event:log",
        pageSize: 1,
      })
    )
  )

  const result = await repository.fetchFlatRows(plan)
  const decodedCursor = JSON.parse(
    Buffer.from(result.nextCursor ?? "", "base64url").toString("utf8")
  ) as { id: string; occurredAt: string }

  assert.equal(
    result.rows[0]?.apiKey.id,
    "223e4567-e89b-42d3-a456-426614174000"
  )
  assert.equal(result.rows[0]?.apiKey.maskedKey, "trk_test...1234")
  assert.deepEqual(result.rows[0]?.metadata, { clientId: "abc-1" })
  assert.equal(
    result.rows[0]?.occurredAt.toISOString(),
    "2026-03-31T00:00:00.000Z"
  )
  assert.equal(decodedCursor.id, "00000000-0000-4000-8000-000000000001")
  assert.equal(decodedCursor.occurredAt, "2026-03-31T00:00:00.000Z")
  assert.equal(result.hasMore, true)
  assert.match(fakeDb.sql[0] ?? "", /as "api_key_id"/)
  assert.match(fakeDb.sql[0] ?? "", /as "occurred_at"/)
})

test("UsageEventSqlRepository fetchFlatRows omits the cursor on the last page", async () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()
  const fakeDb = new FakeRawSqlDatabase([
    [
      {
        api_key_id: "223e4567-e89b-42d3-a456-426614174000",
        api_key_last_four: "1234",
        api_key_name: "Primary key",
        api_key_prefix: "trk_test",
        id: "00000000-0000-4000-8000-000000000001",
        metadata: { clientId: "abc-1" },
        occurred_at: "2026-03-31T00:00:00.000Z",
        payload: { event: "log", level: "info" },
        sort_value: "log",
      },
    ],
  ])
  const repository = new UsageEventSqlRepository(fakeDb)
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: "event:log",
      })
    )
  )

  const result = await repository.fetchFlatRows(plan)

  assert.equal(result.hasMore, false)
  assert.equal(result.nextCursor, null)
})

test("UsageEventSqlRepository fetchGroupedRows only returns a cursor when another page exists", async () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()
  const fakeDb = new FakeRawSqlDatabase([
    [
      {
        api_keys: [
          {
            id: "223e4567-e89b-42d3-a456-426614174000",
            name: "Primary key",
            maskedKey: "trk_test...1234",
          },
        ],
        first_occurred_at: "2026-03-31T00:00:00.000Z",
        group_identity: '"warn"',
        group_value: "warn",
        last_occurred_at: "2026-03-31T00:01:00.000Z",
        sort_value: "warn",
        total_hits: "2",
      },
      {
        api_keys: [
          {
            id: "223e4567-e89b-42d3-a456-426614174000",
            name: "Primary key",
            maskedKey: "trk_test...1234",
          },
        ],
        first_occurred_at: "2026-03-31T00:02:00.000Z",
        group_identity: '"/billing"',
        group_value: "/billing",
        last_occurred_at: "2026-03-31T00:03:00.000Z",
        sort_value: "/billing",
        total_hits: "1",
      },
    ],
    [{ count: "2" }],
    [{ count: "2" }],
  ])
  const repository = new UsageEventSqlRepository(fakeDb)
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        aggregation: "payload_field",
        aggregateField: "level",
        query: "event:log",
        pageSize: 1,
        sort: "lastOccurredAt",
      })
    )
  )

  const result = await repository.fetchGroupedRowsPage(plan)
  const totals = await repository.fetchGroupedTotals(plan)
  const decodedCursor = JSON.parse(
    Buffer.from(result.nextCursor ?? "", "base64url").toString("utf8")
  ) as { groupIdentity: string; sortValue: string }

  assert.equal(result.rows[0]?.id, 'level:"warn"')
  assert.equal(result.rows[0]?.groupValue, "warn")
  assert.equal(result.rows[0]?.totalHits, 2)
  assert.equal(
    result.rows[0]?.lastOccurredAt.toISOString(),
    "2026-03-31T00:01:00.000Z"
  )
  assert.equal(decodedCursor.groupIdentity, '"warn"')
  assert.equal(decodedCursor.sortValue, "2026-03-31T00:01:00.000Z")
  assert.equal(totals.totalMatchedEvents, 2)
  assert.equal(totals.totalGroupedRows, 2)
  assert.equal(result.hasMore, true)
  assert.match(fakeDb.sql[0] ?? "", /"group_identity"/)
})

test("UsageEventSqlRepository fetchGroupedRows omits the cursor on the last page", async () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()
  const fakeDb = new FakeRawSqlDatabase([
    [
      {
        api_keys: [
          {
            id: "223e4567-e89b-42d3-a456-426614174000",
            name: "Primary key",
            maskedKey: "trk_test...1234",
          },
        ],
        first_occurred_at: "2026-03-31T00:00:00.000Z",
        group_identity: '"warn"',
        group_value: "warn",
        last_occurred_at: "2026-03-31T00:01:00.000Z",
        sort_value: "warn",
        total_hits: "2",
      },
    ],
    [{ count: "2" }],
    [{ count: "1" }],
  ])
  const repository = new UsageEventSqlRepository(fakeDb)
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        aggregation: "payload_field",
        aggregateField: "level",
        query: "event:log",
        sort: "lastOccurredAt",
      })
    )
  )

  const result = await repository.fetchGroupedRowsPage(plan)

  assert.equal(result.hasMore, false)
  assert.equal(result.nextCursor, null)
})

test("UsageEventSqlRepository count and field discovery methods normalize raw aggregate rows", async () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()
  const fakeDb = new FakeRawSqlDatabase([
    [{ count: "42" }],
    [{ field: "event" }, { field: "level" }, { field: "route" }],
    [{ count: "3" }],
  ])
  const repository = new UsageEventSqlRepository(fakeDb)
  const flatPlan = planner.plan(
    parser.parse(
      createSearchInput({
        query: "event:log",
      })
    )
  )
  const groupedPlan = planner.plan(
    parser.parse(
      createSearchInput({
        aggregation: "payload_field",
        aggregateField: "level",
        query: "event:log",
      })
    )
  )

  assert.equal(await repository.countFlatRows(flatPlan), 42)
  assert.deepEqual(
    await repository.fetchAvailableAggregateFields(groupedPlan),
    {
      fields: ["event", "level", "route"],
    }
  )
  assert.equal(await repository.countGroupedRows(groupedPlan), 3)
  assert.match(fakeDb.sql[2] ?? "", /count\(distinct/)
})

test("UsageEventSqlRepository executes an apiKey.id search by casting the UUID to text", async () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()
  const client = await createPgMemUsageEventDatabase()

  try {
    await client.query(`
      insert into api_keys (id, last_four, name, key_prefix)
      values
        ('223e4567-e89b-42d3-a456-426614174000', '1234', 'Primary key', 'trk_test'),
        ('223e4567-e89b-42d3-a456-426614174001', '5678', 'Backup key', 'trk_test');

      insert into trackable_api_usage_events (
        id,
        trackable_id,
        api_key_id,
        occurred_at,
        payload,
        metadata
      )
      values
        (
          '00000000-0000-4000-8000-000000000001',
          '123e4567-e89b-42d3-a456-426614174000',
          '223e4567-e89b-42d3-a456-426614174000',
          '2026-03-31T00:00:00.000Z',
          '{"event":"signup","route":"/sam","details":{"label":"customer"}}',
          '{"client":{"name":"Sam Example"}}'
        ),
        (
          '00000000-0000-4000-8000-000000000002',
          '123e4567-e89b-42d3-a456-426614174000',
          '223e4567-e89b-42d3-a456-426614174001',
          '2026-03-30T00:00:00.000Z',
          '{"event":"login","route":"/billing"}',
          '{"client":{"name":"Taylor"}}'
        );
    `)

    const repository = new UsageEventSqlRepository({
      async execute(query: SQLWrapper) {
        const built = (
          query as { toSQL: () => { sql: string; params: unknown[] } }
        ).toSQL()
        const result = await client.query(built.sql, built.params)

        return { rows: result.rows as Record<string, unknown>[] }
      },
    })

    const plan = planner.plan(
      parser.parse(
        createSearchInput({
          query: 'apiKey.id:"223e4567-e89b-42d3-a456-426614174000"',
        })
      )
    )
    const total = await repository.countFlatRows(plan)

    assert.equal(total, 1)
  } finally {
    await client.end()
  }
})
