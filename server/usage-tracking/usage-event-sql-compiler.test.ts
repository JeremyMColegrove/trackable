import assert from "node:assert/strict"
import test from "node:test"

import {
  type UsageEventSearchInput,
} from "@/lib/usage-event-search"
import { USAGE_EVENT_PAGE_SIZE } from "@/server/usage-tracking/usage-event-config"
import { UsageEventQueryPlanner } from "@/server/usage-tracking/usage-event-query-planner"
import { UsageEventSearchParser } from "@/server/usage-tracking/usage-event-search-parser"
import { UsageEventSqlCompiler } from "@/server/usage-tracking/usage-event-sql-compiler"

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

test("UsageEventSqlCompiler resolves payload, apiKey, occurredAt, and metadata fields", () => {
  const parser = new UsageEventSearchParser()
  const compiler = new UsageEventSqlCompiler()
  const parsed = parser.parse(
    createSearchInput({
      query:
        "event:signup AND apiKey.name:primary AND occurredAt:/2026/ AND metadata.user.id:123",
    })
  )

  assert.deepEqual(compiler.compile(parsed.expression), {
    kind: "logical",
    operator: "and",
    left: {
      kind: "logical",
      operator: "and",
      left: {
        kind: "logical",
        operator: "and",
        left: {
          kind: "comparison",
          field: { kind: "payload", path: ["event"] },
          operator: "match",
          quoted: false,
          value: "signup",
        },
        right: {
          kind: "comparison",
          field: { kind: "apiKey", key: "name" },
          operator: "match",
          quoted: false,
          value: "primary",
        },
      },
      right: {
        kind: "regex",
        field: { kind: "occurredAt" },
        value: "/2026/",
      },
    },
    right: {
      kind: "comparison",
      field: { kind: "metadata", path: ["user", "id"] },
      operator: "match",
      quoted: false,
      value: 123,
    },
  })
})

test("UsageEventSqlCompiler keeps logical nesting and NOT expressions intact", () => {
  const parser = new UsageEventSearchParser()
  const compiler = new UsageEventSqlCompiler()
  const parsed = parser.parse(
    createSearchInput({
      query: "NOT (event:signup OR metadata.route:/billing/)",
    })
  )

  assert.deepEqual(compiler.compile(parsed.expression), {
    kind: "not",
    operand: {
      kind: "logical",
      operator: "or",
      left: {
        kind: "comparison",
        field: { kind: "payload", path: ["event"] },
        operator: "match",
        quoted: false,
        value: "signup",
      },
      right: {
        kind: "regex",
        field: { kind: "metadata", path: ["route"] },
        value: "/billing/",
      },
    },
  })
})

test("UsageEventSqlCompiler resolves implicit-field and regex compatibility expressions", () => {
  const parser = new UsageEventSearchParser()
  const compiler = new UsageEventSqlCompiler()
  const implicitMatch = parser.parse(
    createSearchInput({
      query: '"foo"',
    })
  )
  const regexWithNoOpFlag = parser.parse(
    createSearchInput({
      query: "name:/foo/o",
    })
  )

  assert.deepEqual(compiler.compile(implicitMatch.expression), {
    kind: "comparison",
    field: { kind: "implicit" },
    operator: "match",
    quoted: true,
    value: "foo",
  })
  assert.deepEqual(compiler.compile(regexWithNoOpFlag.expression), {
    kind: "regex",
    field: { kind: "payload", path: ["name"] },
    value: "/foo/",
  })
})

test("UsageEventQueryPlanner chooses grouped execution when grouping is enabled", () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()
  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        aggregation: "payload_field",
        aggregateField: "route",
        query: "event:signup",
      })
    )
  )

  assert.equal(plan.executionMode, "grouped")
  assert.deepEqual(plan.filterExpression, {
    kind: "comparison",
    field: { kind: "payload", path: ["event"] },
    operator: "match",
    quoted: false,
    value: "signup",
  })
})
