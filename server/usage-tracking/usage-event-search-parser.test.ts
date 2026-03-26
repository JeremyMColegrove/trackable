import assert from "node:assert/strict"
import test from "node:test"

import type { UsageEventSearchInput } from "@/lib/usage-event-search"
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

test("UsageEventSearchParser normalizes explicit field comparisons", () => {
  const parser = new UsageEventSearchParser()
  const result = parser.parse(
    createSearchInput({
      query: 'event:signup AND apiKey.name:"Primary key"',
    })
  )

  assert.deepEqual(result.expression, {
    kind: "logical",
    operator: "and",
    left: {
      kind: "comparison",
      fieldPath: ["event"],
      operator: "eq",
      value: "signup",
    },
    right: {
      kind: "comparison",
      fieldPath: ["apiKey", "name"],
      operator: "eq",
      value: "Primary key",
    },
  })
})

test("UsageEventSearchParser preserves regex expressions for fallback evaluation", () => {
  const parser = new UsageEventSearchParser()
  const result = parser.parse(
    createSearchInput({
      query: "route:/billing/",
    })
  )

  assert.deepEqual(result.expression, {
    kind: "regex",
    fieldPath: ["route"],
    value: "/billing/",
  })
})

test("UsageEventSearchParser normalizes NOT and range expressions", () => {
  const parser = new UsageEventSearchParser()
  const result = parser.parse(
    createSearchInput({
      query: "NOT event:signup AND duration:[1 TO 5]",
    })
  )

  assert.deepEqual(result.expression, {
    kind: "logical",
    operator: "and",
    left: {
      kind: "not",
      operand: {
        kind: "comparison",
        fieldPath: ["event"],
        operator: "eq",
        value: "signup",
      },
    },
    right: {
      kind: "range",
      fieldPath: ["duration"],
      min: 1,
      minInclusive: true,
      max: 5,
      maxInclusive: true,
    },
  })
})

test("UsageEventSearchParser preserves nested field paths for fallback evaluation", () => {
  const parser = new UsageEventSearchParser()
  const result = parser.parse(
    createSearchInput({
      query: 'metadata.user.email:"test@example.com"',
    })
  )

  assert.deepEqual(result.expression, {
    kind: "comparison",
    fieldPath: ["metadata", "user", "email"],
    operator: "eq",
    value: "test@example.com",
  })
})

test("UsageEventSearchParser builds a matcher that handles complex liqe expressions", () => {
  const parser = new UsageEventSearchParser()
  const result = parser.parse(
    createSearchInput({
      query: '(event:signup OR event:login) AND apiKey.name:"Primary key"',
    })
  )

  assert.equal(
    result.matchesRecord({
      id: "00000000-0000-4000-8000-000000000001",
      occurredAt: new Date("2026-03-26T10:00:00.000Z"),
      payload: { event: "signup" },
      metadata: null,
      apiKey: {
        id: "223e4567-e89b-42d3-a456-426614174000",
        name: "Primary key",
        maskedKey: "trk_test...1234",
      },
    }),
    true
  )

  assert.equal(
    result.matchesRecord({
      id: "00000000-0000-4000-8000-000000000002",
      occurredAt: new Date("2026-03-26T10:00:00.000Z"),
      payload: { event: "purchase" },
      metadata: null,
      apiKey: {
        id: "223e4567-e89b-42d3-a456-426614174000",
        name: "Primary key",
        maskedKey: "trk_test...1234",
      },
    }),
    false
  )
})

test("UsageEventSearchParser throws a BAD_REQUEST error for invalid liqe", () => {
  const parser = new UsageEventSearchParser()

  assert.throws(
    () =>
      parser.parse(
        createSearchInput({
          query: "event:(",
        })
      ),
    { message: /Syntax error/ }
  )
})
