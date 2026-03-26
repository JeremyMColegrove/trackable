import assert from "node:assert/strict"
import test from "node:test"

import type { UsageEventSearchInput } from "@/lib/usage-event-search"
import { UsageEventQueryPlanner } from "@/server/usage-tracking/usage-event-query-planner"
import { UsageEventSearchParser } from "@/server/usage-tracking/usage-event-search-parser"

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

test("UsageEventQueryPlanner keeps simple equality filters in SQL", () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()

  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: 'event:signup AND apiKey.name:"Primary key"',
      })
    )
  )

  assert.equal(plan.evaluationMode, "sql_only")
  assert.deepEqual(plan.sqlPredicates, [
    {
      field: { kind: "payload", key: "event" },
      operator: "eq",
      value: "signup",
    },
    {
      field: { kind: "apiKey", key: "name" },
      operator: "eq",
      value: "Primary key",
    },
  ])
})

test("UsageEventQueryPlanner falls back for OR queries while preserving SQL-safe AND terms", () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()

  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: "event:signup AND (route:/billing/ OR level:error)",
      })
    )
  )

  assert.equal(plan.evaluationMode, "sql_plus_fallback")
  assert.deepEqual(plan.sqlPredicates, [
    {
      field: { kind: "payload", key: "event" },
      operator: "eq",
      value: "signup",
    },
  ])
})

test("UsageEventQueryPlanner chooses grouped execution when grouping is enabled", () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()

  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        aggregation: "payload_field",
        aggregateField: "route",
      })
    )
  )

  assert.equal(plan.executionMode, "grouped")
})

test("UsageEventQueryPlanner keeps top-level payload equality predicates SQL-safe", () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()

  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: 'route:"/billing" AND level:error',
      })
    )
  )

  assert.equal(plan.evaluationMode, "sql_only")
  assert.deepEqual(plan.sqlPredicates, [
    {
      field: { kind: "payload", key: "route" },
      operator: "eq",
      value: "/billing",
    },
    {
      field: { kind: "payload", key: "level" },
      operator: "eq",
      value: "error",
    },
  ])
})

test("UsageEventQueryPlanner falls back for nested payload paths", () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()

  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: 'metadata.user.email:"test@example.com"',
      })
    )
  )

  assert.equal(plan.evaluationMode, "sql_plus_fallback")
  assert.deepEqual(plan.sqlPredicates, [])
})

test("UsageEventQueryPlanner falls back for NOT expressions even when inner term is SQL-safe", () => {
  const parser = new UsageEventSearchParser()
  const planner = new UsageEventQueryPlanner()

  const plan = planner.plan(
    parser.parse(
      createSearchInput({
        query: "NOT event:signup",
      })
    )
  )

  assert.equal(plan.evaluationMode, "sql_plus_fallback")
  assert.deepEqual(plan.sqlPredicates, [])
})
