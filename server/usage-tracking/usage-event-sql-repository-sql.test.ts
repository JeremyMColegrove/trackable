import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import test from "node:test"

import {
  type UsageEventSearchInput,
} from "@/lib/usage-event-search"
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

function normalizeSql(sqlText: string) {
  return sqlText
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .trim()
}

function encodeCursor(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}

function createRepositoryFixtures() {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()
  const repository = new UsageEventSqlRepository()

  return {
    parser,
    planner,
    repository,
  }
}

test("UsageEventSqlRepository builds the exact flat count SQL", () => {
  const { parser, planner, repository } = createRepositoryFixtures()
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: 'event:"signup" AND apiKey.name:primary AND metadata.route:/billing/',
      })
    )
  )

  const query = repository.buildCountFlatRowsQuery(plan).toSQL()

  assert.equal(
    normalizeSql(query.sql),
    normalizeSql(`
      select count("trackable_api_usage_events"."id")
      from "trackable_api_usage_events"
      inner join "api_keys"
        on "trackable_api_usage_events"."api_key_id" = "api_keys"."id"
      where (
        "trackable_api_usage_events"."trackable_id" = $1
        and (
          (
            case
              when (("trackable_api_usage_events"."payload" #> ARRAY[$2]::text[])) is null then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$3]::text[]))) = 'null' then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$4]::text[]))) in ('string', 'number', 'boolean')
                then (("trackable_api_usage_events"."payload" #> ARRAY[$5]::text[])) #>> ARRAY[]::text[]
              else ((("trackable_api_usage_events"."payload" #> ARRAY[$6]::text[])))::text
            end is not null
            and
            case
              when (("trackable_api_usage_events"."payload" #> ARRAY[$7]::text[])) is null then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$8]::text[]))) = 'null' then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$9]::text[]))) in ('string', 'number', 'boolean')
                then (("trackable_api_usage_events"."payload" #> ARRAY[$10]::text[])) #>> ARRAY[]::text[]
              else ((("trackable_api_usage_events"."payload" #> ARRAY[$11]::text[])))::text
            end ~ $12
            and "api_keys"."name" is not null
            and "api_keys"."name" ~ $13
          )
          and
          case
            when (("trackable_api_usage_events"."metadata" #> ARRAY[$14]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$15]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$16]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."metadata" #> ARRAY[$17]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."metadata" #> ARRAY[$18]::text[])))::text
          end is not null
          and
          case
            when (("trackable_api_usage_events"."metadata" #> ARRAY[$19]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$20]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$21]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."metadata" #> ARRAY[$22]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."metadata" #> ARRAY[$23]::text[])))::text
          end ~ $24
        )
      )
    `)
  )
  assert.deepEqual(query.params, [
    "123e4567-e89b-42d3-a456-426614174000",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "signup",
    "(?i)primary",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "billing",
  ])
})

test("UsageEventSqlRepository builds the exact flat fetch SQL", () => {
  const { parser, planner, repository } = createRepositoryFixtures()
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: 'event:"signup" AND apiKey.name:primary AND metadata.route:/billing/',
      })
    )
  )

  const query = repository.buildFetchFlatRowsQuery(plan).toSQL()

  assert.equal(
    normalizeSql(query.sql),
    normalizeSql(`
      select
        "api_keys"."id" as "api_key_id",
        "api_keys"."last_four" as "api_key_last_four",
        "api_keys"."name" as "api_key_name",
        "api_keys"."key_prefix" as "api_key_prefix",
        "trackable_api_usage_events"."id" as "id",
        "trackable_api_usage_events"."metadata" as "metadata",
        "trackable_api_usage_events"."occurred_at" as "occurred_at",
        "trackable_api_usage_events"."payload" as "payload",
        coalesce(
          case
            when (("trackable_api_usage_events"."payload" #> ARRAY[$1]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$2]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$3]::text[]))) in ('string', 'number', 'boolean')
              then nullif(btrim((("trackable_api_usage_events"."payload" #> ARRAY[$4]::text[])) #>> ARRAY[]::text[]), '')
            else ((("trackable_api_usage_events"."payload" #> ARRAY[$5]::text[])))::text
          end,
          ''
        ) as "sort_value"
      from "trackable_api_usage_events"
      inner join "api_keys"
        on "trackable_api_usage_events"."api_key_id" = "api_keys"."id"
      where (
        "trackable_api_usage_events"."trackable_id" = $6
        and (
          (
            case
              when (("trackable_api_usage_events"."payload" #> ARRAY[$7]::text[])) is null then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$8]::text[]))) = 'null' then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$9]::text[]))) in ('string', 'number', 'boolean')
                then (("trackable_api_usage_events"."payload" #> ARRAY[$10]::text[])) #>> ARRAY[]::text[]
              else ((("trackable_api_usage_events"."payload" #> ARRAY[$11]::text[])))::text
            end is not null
            and
            case
              when (("trackable_api_usage_events"."payload" #> ARRAY[$12]::text[])) is null then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$13]::text[]))) = 'null' then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$14]::text[]))) in ('string', 'number', 'boolean')
                then (("trackable_api_usage_events"."payload" #> ARRAY[$15]::text[])) #>> ARRAY[]::text[]
              else ((("trackable_api_usage_events"."payload" #> ARRAY[$16]::text[])))::text
            end ~ $17
            and "api_keys"."name" is not null
            and "api_keys"."name" ~ $18
          )
          and
          case
            when (("trackable_api_usage_events"."metadata" #> ARRAY[$19]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$20]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$21]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."metadata" #> ARRAY[$22]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."metadata" #> ARRAY[$23]::text[])))::text
          end is not null
          and
          case
            when (("trackable_api_usage_events"."metadata" #> ARRAY[$24]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$25]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$26]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."metadata" #> ARRAY[$27]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."metadata" #> ARRAY[$28]::text[])))::text
          end ~ $29
        )
      )
      order by "trackable_api_usage_events"."occurred_at" desc, "trackable_api_usage_events"."id" desc
      limit $30
    `)
  )
  assert.deepEqual(query.params, [
    "event",
    "event",
    "event",
    "event",
    "event",
    "123e4567-e89b-42d3-a456-426614174000",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "signup",
    "(?i)primary",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "billing",
    USAGE_EVENT_PAGE_SIZE + 1,
  ])
})

test("UsageEventSqlRepository builds the exact event-sort keyset SQL", () => {
  const { parser, planner, repository } = createRepositoryFixtures()
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        sort: "event",
        dir: "asc",
        cursor: encodeCursor({
          occurredAt: "2026-03-31T00:00:00.000Z",
          id: "00000000-0000-4000-8000-000000000123",
          sortValue: "signup",
        }),
        query: 'metadata.route:"/billing" AND occurredAt:/2026-03-31/',
      })
    )
  )

  const query = repository.buildFetchFlatRowsQuery(plan).toSQL()

  assert.equal(
    normalizeSql(query.sql),
    normalizeSql(`
      select
        "api_keys"."id" as "api_key_id",
        "api_keys"."last_four" as "api_key_last_four",
        "api_keys"."name" as "api_key_name",
        "api_keys"."key_prefix" as "api_key_prefix",
        "trackable_api_usage_events"."id" as "id",
        "trackable_api_usage_events"."metadata" as "metadata",
        "trackable_api_usage_events"."occurred_at" as "occurred_at",
        "trackable_api_usage_events"."payload" as "payload",
        coalesce(
          case
            when (("trackable_api_usage_events"."payload" #> ARRAY[$1]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$2]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$3]::text[]))) in ('string', 'number', 'boolean')
              then nullif(btrim((("trackable_api_usage_events"."payload" #> ARRAY[$4]::text[])) #>> ARRAY[]::text[]), '')
            else ((("trackable_api_usage_events"."payload" #> ARRAY[$5]::text[])))::text
          end,
          ''
        ) as "sort_value"
      from "trackable_api_usage_events"
      inner join "api_keys"
        on "trackable_api_usage_events"."api_key_id" = "api_keys"."id"
      where (
        (
          "trackable_api_usage_events"."trackable_id" = $6
          and
          (
            case
              when (("trackable_api_usage_events"."metadata" #> ARRAY[$7]::text[])) is null then null
              when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$8]::text[]))) = 'null' then null
              when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$9]::text[]))) in ('string', 'number', 'boolean')
                then (("trackable_api_usage_events"."metadata" #> ARRAY[$10]::text[])) #>> ARRAY[]::text[]
              else ((("trackable_api_usage_events"."metadata" #> ARRAY[$11]::text[])))::text
            end is not null
            and
            case
              when (("trackable_api_usage_events"."metadata" #> ARRAY[$12]::text[])) is null then null
              when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$13]::text[]))) = 'null' then null
              when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$14]::text[]))) in ('string', 'number', 'boolean')
                then (("trackable_api_usage_events"."metadata" #> ARRAY[$15]::text[])) #>> ARRAY[]::text[]
              else ((("trackable_api_usage_events"."metadata" #> ARRAY[$16]::text[])))::text
            end ~ $17
            and to_char("trackable_api_usage_events"."occurred_at" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is not null
            and to_char("trackable_api_usage_events"."occurred_at" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ~ $18
          )
        )
        and (
          coalesce(
            coalesce(
              case
                when (("trackable_api_usage_events"."payload" #> ARRAY[$19]::text[])) is null then null
                when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$20]::text[]))) = 'null' then null
                when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$21]::text[]))) in ('string', 'number', 'boolean')
                  then nullif(btrim((("trackable_api_usage_events"."payload" #> ARRAY[$22]::text[])) #>> ARRAY[]::text[]), '')
                else ((("trackable_api_usage_events"."payload" #> ARRAY[$23]::text[])))::text
              end,
              ''
            ),
            ''
          ) > $24
          or (
            coalesce(
              coalesce(
                case
                  when (("trackable_api_usage_events"."payload" #> ARRAY[$25]::text[])) is null then null
                  when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$26]::text[]))) = 'null' then null
                  when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$27]::text[]))) in ('string', 'number', 'boolean')
                    then nullif(btrim((("trackable_api_usage_events"."payload" #> ARRAY[$28]::text[])) #>> ARRAY[]::text[]), '')
                  else ((("trackable_api_usage_events"."payload" #> ARRAY[$29]::text[])))::text
                end,
                ''
              ),
              ''
            ) = $30
            and "trackable_api_usage_events"."occurred_at" > $31
          )
          or (
            coalesce(
              coalesce(
                case
                  when (("trackable_api_usage_events"."payload" #> ARRAY[$32]::text[])) is null then null
                  when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$33]::text[]))) = 'null' then null
                  when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$34]::text[]))) in ('string', 'number', 'boolean')
                    then nullif(btrim((("trackable_api_usage_events"."payload" #> ARRAY[$35]::text[])) #>> ARRAY[]::text[]), '')
                  else ((("trackable_api_usage_events"."payload" #> ARRAY[$36]::text[])))::text
                end,
                ''
              ),
              ''
            ) = $37
            and "trackable_api_usage_events"."occurred_at" = $38
            and "trackable_api_usage_events"."id" > $39
          )
        )
      )
      order by
        coalesce(
          coalesce(
            case
              when (("trackable_api_usage_events"."payload" #> ARRAY[$40]::text[])) is null then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$41]::text[]))) = 'null' then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$42]::text[]))) in ('string', 'number', 'boolean')
                then nullif(btrim((("trackable_api_usage_events"."payload" #> ARRAY[$43]::text[])) #>> ARRAY[]::text[]), '')
              else ((("trackable_api_usage_events"."payload" #> ARRAY[$44]::text[])))::text
            end,
            ''
          ),
          ''
        ) asc,
        "trackable_api_usage_events"."occurred_at" asc,
        "trackable_api_usage_events"."id" asc
      limit $45
    `)
  )
  assert.deepEqual(query.params, [
    "event",
    "event",
    "event",
    "event",
    "event",
    "123e4567-e89b-42d3-a456-426614174000",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "route",
    "/billing",
    "2026-03-31",
    "event",
    "event",
    "event",
    "event",
    "event",
    "signup",
    "event",
    "event",
    "event",
    "event",
    "event",
    "signup",
    new Date("2026-03-31T00:00:00.000Z"),
    "event",
    "event",
    "event",
    "event",
    "event",
    "signup",
    new Date("2026-03-31T00:00:00.000Z"),
    "00000000-0000-4000-8000-000000000123",
    "event",
    "event",
    "event",
    "event",
    "event",
    USAGE_EVENT_PAGE_SIZE + 1,
  ])
})

test("UsageEventSqlRepository supports the Liqe syntax matrix end-to-end", () => {
  const { parser, planner, repository } = createRepositoryFixtures()
  const cases = [
    {
      query: "foo",
      expectedParams: ["(?i)foo"],
    },
    {
      query: "'foo'",
      expectedParams: ["foo"],
    },
    {
      query: '"foo"',
      expectedParams: ["foo"],
    },
    {
      query: "name:foo",
      expectedParams: ["name", "(?i)foo"],
    },
    {
      query: "'full name':foo",
      expectedParams: ["full name", "(?i)foo"],
    },
    {
      query: '"full name":foo',
      expectedParams: ["full name", "(?i)foo"],
    },
    {
      query: "name.first:foo",
      expectedParams: ["name", "first", "(?i)foo"],
    },
    {
      query: "name:/foo/",
      expectedParams: ["name", "foo"],
    },
    {
      query: "name:/foo/o",
      expectedParams: ["name", "foo"],
    },
    {
      query: "name:foo*bar",
      expectedParams: ["name", "(?i)foo(.+?)bar"],
    },
    {
      query: "name:foo?bar",
      expectedParams: ["name", "(?i)foo(.)bar"],
    },
    {
      query: "member:true",
      expectedParams: ["member", "true"],
    },
    {
      query: "member:false",
      expectedParams: ["member", "false"],
    },
    {
      query: "member:null",
      expectedParams: ["member"],
      expectedSqlPattern: /jsonb_typeof/,
    },
    {
      query: "height:=100",
      expectedParams: ["height", 100],
    },
    {
      query: 'metadata.logId:="event-1"',
      expectedParams: ["logId", "string", "event-1"],
      expectedSqlPattern: /jsonb_typeof\(.+\) = .+ and .+ = /,
    },
    {
      query: "height:>100",
      expectedParams: ["height", 100],
    },
    {
      query: "height:>=100",
      expectedParams: ["height", 100],
    },
    {
      query: "height:<100",
      expectedParams: ["height", 100],
    },
    {
      query: "height:<=100",
      expectedParams: ["height", 100],
    },
    {
      query: "height:[100 TO 200]",
      expectedParams: ["height", 100, 200],
    },
    {
      query: "height:{100 TO 200}",
      expectedParams: ["height", 100, 200],
    },
    {
      query: "name:foo AND height:=100",
      expectedParams: ["name", "(?i)foo", "height", 100],
      expectedSqlPattern: /\sand\s/,
    },
    {
      query: "name:foo OR name:bar",
      expectedParams: ["name", "(?i)foo", "name", "(?i)bar"],
      expectedSqlPattern: /\sor\s/,
    },
    {
      query: "NOT foo",
      expectedParams: ["(?i)foo"],
      expectedSqlPattern: /not \(/,
    },
    {
      query: "-foo",
      expectedParams: ["(?i)foo"],
      expectedSqlPattern: /not \(/,
    },
    {
      query: "NOT foo:bar",
      expectedParams: ["foo", "(?i)bar"],
      expectedSqlPattern: /not \(/,
    },
    {
      query: "-foo:bar",
      expectedParams: ["foo", "(?i)bar"],
      expectedSqlPattern: /not \(/,
    },
    {
      query: "name:foo AND NOT (bio:bar OR bio:baz)",
      expectedParams: ["name", "(?i)foo", "bio", "(?i)bar", "bio", "(?i)baz"],
      expectedSqlPattern: /not \(.+\sor\s.+\)/,
    },
    {
      query: "name:foo height:=100",
      expectedParams: ["name", "(?i)foo", "height", 100],
      expectedSqlPattern: /\sand\s/,
    },
    {
      query: "name:foo AND (bio:bar OR bio:baz)",
      expectedParams: ["name", "(?i)foo", "bio", "(?i)bar", "bio", "(?i)baz"],
      expectedSqlPattern: /\sand\s.+\sor\s/,
    },
  ] as const

  for (const testCase of cases) {
    const plan = planner.plan(
      parser.parse(
        createSearchInput({
          query: testCase.query,
        })
      )
    )
    const query = repository.buildCountFlatRowsQuery(plan).toSQL()

    for (const expectedParam of testCase.expectedParams) {
      assert.ok(
        query.params.includes(expectedParam),
        `Expected query params for "${testCase.query}" to include ${String(expectedParam)}`
      )
    }

    if (testCase.expectedSqlPattern) {
      assert.match(
        normalizeSql(query.sql),
        testCase.expectedSqlPattern,
        `Expected SQL for "${testCase.query}" to match ${String(testCase.expectedSqlPattern)}`
      )
    }
  }
})

test("UsageEventSqlRepository keeps bare keyword SQL compact enough to avoid duplicated JSON recursion", () => {
  const { parser, planner, repository } = createRepositoryFixtures()
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: "sam",
      })
    )
  )
  const query = normalizeSql(repository.buildFetchFlatRowsQuery(plan).toSQL().sql)

  assert.match(query, /with recursive json_values\(value\) as/)
  assert.equal(query.match(/with recursive json_values\(value\) as/g)?.length ?? 0, 1)
  assert.equal(query.match(/exists \(/g)?.length ?? 0, 1)
  assert.match(query, /"api_keys"\."id"::text ~/)
})

test("UsageEventSqlRepository builds the exact grouped fetch SQL", () => {
  const { parser, planner, repository } = createRepositoryFixtures()
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        aggregation: "payload_field",
        aggregateField: "route",
        sort: "totalHits",
        dir: "desc",
        cursor: encodeCursor({
          groupIdentity: '"/billing"',
          sortValue: 7,
        }),
        query: "event:signup AND metadata.clientId:abc*",
      })
    )
  )

  const query = repository.buildFetchGroupedRowsQuery(plan).toSQL()

  assert.equal(
    normalizeSql(query.sql),
    normalizeSql(`
      select
        "api_keys",
        "first_occurred_at",
        "group_identity",
        "group_value",
        "last_occurred_at",
        "sort_value",
        "total_hits"
      from (
        select
          coalesce(
            jsonb_agg(
              distinct jsonb_build_object(
                'id', "id",
                'name', "name",
                'maskedKey', "key_prefix" || '...' || "last_four"
              )
            ) filter (where "id" is not null),
            '[]'::jsonb
          ) as "api_keys",
          min("occurred_at") as "first_occurred_at",
          "group_identity",
          max("group_value") as "group_value",
          max("occurred_at") as "last_occurred_at",
          coalesce(max("group_value"), '') as "sort_value",
          count(*) as "total_hits"
        from (
          select
            "api_keys"."id",
            "api_keys"."last_four",
            "api_keys"."name",
            "api_keys"."key_prefix",
            coalesce(("trackable_api_usage_events"."payload" #> ARRAY[$1]::text[])::text, $2) as "group_identity",
            case
              when (("trackable_api_usage_events"."payload" #> ARRAY[$3]::text[])) is null then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$4]::text[]))) = 'null' then null
              when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$5]::text[]))) in ('string', 'number', 'boolean')
                then nullif(btrim((("trackable_api_usage_events"."payload" #> ARRAY[$6]::text[])) #>> ARRAY[]::text[]), '')
              else ((("trackable_api_usage_events"."payload" #> ARRAY[$7]::text[])))::text
            end as "group_value",
            "trackable_api_usage_events"."occurred_at"
          from "trackable_api_usage_events"
          inner join "api_keys"
            on "trackable_api_usage_events"."api_key_id" = "api_keys"."id"
          where (
            "trackable_api_usage_events"."trackable_id" = $8
            and (
              case
                when (("trackable_api_usage_events"."payload" #> ARRAY[$9]::text[])) is null then null
                when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$10]::text[]))) = 'null' then null
                when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$11]::text[]))) in ('string', 'number', 'boolean')
                  then (("trackable_api_usage_events"."payload" #> ARRAY[$12]::text[])) #>> ARRAY[]::text[]
                else ((("trackable_api_usage_events"."payload" #> ARRAY[$13]::text[])))::text
              end is not null
              and
              case
                when (("trackable_api_usage_events"."payload" #> ARRAY[$14]::text[])) is null then null
                when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$15]::text[]))) = 'null' then null
                when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$16]::text[]))) in ('string', 'number', 'boolean')
                  then (("trackable_api_usage_events"."payload" #> ARRAY[$17]::text[])) #>> ARRAY[]::text[]
                else ((("trackable_api_usage_events"."payload" #> ARRAY[$18]::text[])))::text
              end ~ $19
              and
              case
                when (("trackable_api_usage_events"."metadata" #> ARRAY[$20]::text[])) is null then null
                when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$21]::text[]))) = 'null' then null
                when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$22]::text[]))) in ('string', 'number', 'boolean')
                  then (("trackable_api_usage_events"."metadata" #> ARRAY[$23]::text[])) #>> ARRAY[]::text[]
                else ((("trackable_api_usage_events"."metadata" #> ARRAY[$24]::text[])))::text
              end is not null
              and
              case
                when (("trackable_api_usage_events"."metadata" #> ARRAY[$25]::text[])) is null then null
                when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$26]::text[]))) = 'null' then null
                when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$27]::text[]))) in ('string', 'number', 'boolean')
                  then (("trackable_api_usage_events"."metadata" #> ARRAY[$28]::text[])) #>> ARRAY[]::text[]
                else ((("trackable_api_usage_events"."metadata" #> ARRAY[$29]::text[])))::text
              end ~ $30
            )
          )
        ) "usage_event_group_source"
        group by "group_identity"
      ) "usage_event_groups"
      where ("total_hits" < $31 or ("total_hits" = $32 and "group_identity" < $33))
      order by "total_hits" desc, "group_identity" desc
      limit $34
    `)
  )
  assert.deepEqual(query.params, [
    "route",
    "__missing__",
    "route",
    "route",
    "route",
    "route",
    "route",
    "123e4567-e89b-42d3-a456-426614174000",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "(?i)signup",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "(?i)abc(.+?)",
    7,
    7,
    '"/billing"',
    USAGE_EVENT_PAGE_SIZE + 1,
  ])
})

test("UsageEventSqlRepository builds the exact grouped count SQL", () => {
  const { parser, planner, repository } = createRepositoryFixtures()
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        aggregation: "payload_field",
        aggregateField: "route",
        sort: "totalHits",
        dir: "desc",
        query: "event:signup AND metadata.clientId:abc*",
      })
    )
  )

  const query = repository.buildCountGroupedRowsQuery(plan).toSQL()

  assert.equal(
    normalizeSql(query.sql),
    normalizeSql(`
      select count(distinct coalesce(("trackable_api_usage_events"."payload" #> ARRAY[$1]::text[])::text, $2)) as "count"
      from "trackable_api_usage_events"
      inner join "api_keys"
        on "trackable_api_usage_events"."api_key_id" = "api_keys"."id"
      where (
        "trackable_api_usage_events"."trackable_id" = $3
        and (
          case
            when (("trackable_api_usage_events"."payload" #> ARRAY[$4]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$5]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$6]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."payload" #> ARRAY[$7]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."payload" #> ARRAY[$8]::text[])))::text
          end is not null
          and
          case
            when (("trackable_api_usage_events"."payload" #> ARRAY[$9]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$10]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$11]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."payload" #> ARRAY[$12]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."payload" #> ARRAY[$13]::text[])))::text
          end ~ $14
          and
          case
            when (("trackable_api_usage_events"."metadata" #> ARRAY[$15]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$16]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$17]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."metadata" #> ARRAY[$18]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."metadata" #> ARRAY[$19]::text[])))::text
          end is not null
          and
          case
            when (("trackable_api_usage_events"."metadata" #> ARRAY[$20]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$21]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$22]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."metadata" #> ARRAY[$23]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."metadata" #> ARRAY[$24]::text[])))::text
          end ~ $25
        )
      )
    `)
  )
  assert.deepEqual(query.params, [
    "route",
    "__missing__",
    "123e4567-e89b-42d3-a456-426614174000",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "(?i)signup",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "(?i)abc(.+?)",
  ])
})

test("UsageEventSqlRepository builds the exact aggregate field discovery SQL", () => {
  const { parser, planner, repository } = createRepositoryFixtures()
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        aggregation: "payload_field",
        aggregateField: "route",
        query: "event:signup AND metadata.clientId:abc*",
      })
    )
  )

  const query = repository.dialect.sqlToQuery(
    repository.buildAvailableAggregateFieldsSql(plan)
  )

  assert.equal(
    normalizeSql(query.sql),
    normalizeSql(`
      select distinct payload_keys.field
      from "trackable_api_usage_events"
      inner join "api_keys"
        on "trackable_api_usage_events"."api_key_id" = "api_keys"."id"
      cross join lateral jsonb_object_keys("trackable_api_usage_events"."payload") as payload_keys(field)
      where (
        "trackable_api_usage_events"."trackable_id" = $1
        and (
          case
            when (("trackable_api_usage_events"."payload" #> ARRAY[$2]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$3]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$4]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."payload" #> ARRAY[$5]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."payload" #> ARRAY[$6]::text[])))::text
          end is not null
          and
          case
            when (("trackable_api_usage_events"."payload" #> ARRAY[$7]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$8]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."payload" #> ARRAY[$9]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."payload" #> ARRAY[$10]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."payload" #> ARRAY[$11]::text[])))::text
          end ~ $12
          and
          case
            when (("trackable_api_usage_events"."metadata" #> ARRAY[$13]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$14]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$15]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."metadata" #> ARRAY[$16]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."metadata" #> ARRAY[$17]::text[])))::text
          end is not null
          and
          case
            when (("trackable_api_usage_events"."metadata" #> ARRAY[$18]::text[])) is null then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$19]::text[]))) = 'null' then null
            when jsonb_typeof((("trackable_api_usage_events"."metadata" #> ARRAY[$20]::text[]))) in ('string', 'number', 'boolean')
              then (("trackable_api_usage_events"."metadata" #> ARRAY[$21]::text[])) #>> ARRAY[]::text[]
            else ((("trackable_api_usage_events"."metadata" #> ARRAY[$22]::text[])))::text
          end ~ $23
        )
      )
      order by payload_keys.field asc
    `)
  )
  assert.deepEqual(query.params, [
    "123e4567-e89b-42d3-a456-426614174000",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "event",
    "(?i)signup",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "clientId",
    "(?i)abc(.+?)",
  ])
})
