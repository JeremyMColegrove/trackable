import assert from "node:assert/strict"
import test from "node:test"

import { type UsageEventSearchInput } from "@/lib/usage-event-search"
import { USAGE_EVENT_PAGE_SIZE } from "@/server/usage-tracking/usage-event-config"
import type { UsageEventQueryExpression } from "@/server/usage-tracking/usage-event-query.types"
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
    cursor: null,
    pageSize: USAGE_EVENT_PAGE_SIZE,
    ...overrides,
  }
}

function comparisonExpression(
  fieldPath: string[] | null,
  value: string | number | boolean | null,
  options?: {
    operator?: "match" | "eq" | "gt" | "gte" | "lt" | "lte"
    quoted?: boolean
  }
): UsageEventQueryExpression {
  return {
    kind: "comparison",
    fieldPath,
    operator: options?.operator ?? "match",
    quoted: options?.quoted ?? false,
    value,
  }
}

function rangeExpression(
  fieldPath: string[] | null,
  min: number,
  max: number,
  options?: { minInclusive?: boolean; maxInclusive?: boolean }
): UsageEventQueryExpression {
  return {
    kind: "range",
    fieldPath,
    min,
    minInclusive: options?.minInclusive ?? true,
    max,
    maxInclusive: options?.maxInclusive ?? true,
  }
}

test("UsageEventSearchParser normalizes the supported Liqe syntax matrix", () => {
  const parser = new UsageEventSearchParser()
  const cases: Array<{
    query: string
    expected: UsageEventQueryExpression
  }> = [
    {
      query: "foo",
      expected: comparisonExpression(null, "foo"),
    },
    {
      query: "'foo'",
      expected: comparisonExpression(null, "foo", { quoted: true }),
    },
    {
      query: '"foo"',
      expected: comparisonExpression(null, "foo", { quoted: true }),
    },
    {
      query: "name:foo",
      expected: comparisonExpression(["name"], "foo"),
    },
    {
      query: "'full name':foo",
      expected: comparisonExpression(["full name"], "foo"),
    },
    {
      query: '"full name":foo',
      expected: comparisonExpression(["full name"], "foo"),
    },
    {
      query: "name.first:foo",
      expected: comparisonExpression(["name", "first"], "foo"),
    },
    {
      query: "name:/foo/",
      expected: {
        kind: "regex",
        fieldPath: ["name"],
        value: "/foo/",
      },
    },
    {
      query: "name:/foo/o",
      expected: {
        kind: "regex",
        fieldPath: ["name"],
        value: "/foo/",
      },
    },
    {
      query: "name:foo*bar",
      expected: comparisonExpression(["name"], "foo*bar"),
    },
    {
      query: "name:foo?bar",
      expected: comparisonExpression(["name"], "foo?bar"),
    },
    {
      query: "member:true",
      expected: comparisonExpression(["member"], true),
    },
    {
      query: "member:false",
      expected: comparisonExpression(["member"], false),
    },
    {
      query: "member:null",
      expected: comparisonExpression(["member"], null),
    },
    {
      query: "height:=100",
      expected: comparisonExpression(["height"], 100, { operator: "eq" }),
    },
    {
      query: "height:>100",
      expected: comparisonExpression(["height"], 100, { operator: "gt" }),
    },
    {
      query: "height:>=100",
      expected: comparisonExpression(["height"], 100, { operator: "gte" }),
    },
    {
      query: "height:<100",
      expected: comparisonExpression(["height"], 100, { operator: "lt" }),
    },
    {
      query: "height:<=100",
      expected: comparisonExpression(["height"], 100, { operator: "lte" }),
    },
    {
      query: "height:[100 TO 200]",
      expected: rangeExpression(["height"], 100, 200),
    },
    {
      query: "height:{100 TO 200}",
      expected: rangeExpression(["height"], 100, 200, {
        minInclusive: false,
        maxInclusive: false,
      }),
    },
    {
      query: "name:foo AND height:=100",
      expected: {
        kind: "logical",
        operator: "and",
        left: comparisonExpression(["name"], "foo"),
        right: comparisonExpression(["height"], 100, { operator: "eq" }),
      },
    },
    {
      query: "name:foo OR name:bar",
      expected: {
        kind: "logical",
        operator: "or",
        left: comparisonExpression(["name"], "foo"),
        right: comparisonExpression(["name"], "bar"),
      },
    },
    {
      query: "NOT foo",
      expected: {
        kind: "not",
        operand: comparisonExpression(null, "foo"),
      },
    },
    {
      query: "-foo",
      expected: {
        kind: "not",
        operand: comparisonExpression(null, "foo"),
      },
    },
    {
      query: "NOT foo:bar",
      expected: {
        kind: "not",
        operand: comparisonExpression(["foo"], "bar"),
      },
    },
    {
      query: "-foo:bar",
      expected: {
        kind: "not",
        operand: comparisonExpression(["foo"], "bar"),
      },
    },
    {
      query: "name:foo AND NOT (bio:bar OR bio:baz)",
      expected: {
        kind: "logical",
        operator: "and",
        left: comparisonExpression(["name"], "foo"),
        right: {
          kind: "not",
          operand: {
            kind: "logical",
            operator: "or",
            left: comparisonExpression(["bio"], "bar"),
            right: comparisonExpression(["bio"], "baz"),
          },
        },
      },
    },
    {
      query: "name:foo height:=100",
      expected: {
        kind: "logical",
        operator: "and",
        left: comparisonExpression(["name"], "foo"),
        right: comparisonExpression(["height"], 100, { operator: "eq" }),
      },
    },
    {
      query: "name:foo AND (bio:bar OR bio:baz)",
      expected: {
        kind: "logical",
        operator: "and",
        left: comparisonExpression(["name"], "foo"),
        right: {
          kind: "logical",
          operator: "or",
          left: comparisonExpression(["bio"], "bar"),
          right: comparisonExpression(["bio"], "baz"),
        },
      },
    },
  ]

  for (const testCase of cases) {
    const result = parser.parse(
      createSearchInput({
        query: testCase.query,
      })
    )

    assert.deepEqual(
      result.expression,
      testCase.expected,
      `Unexpected normalized expression for query ${testCase.query}`
    )
  }
})

test("UsageEventSearchParser keeps nested metadata paths for SQL compilation", () => {
  const parser = new UsageEventSearchParser()
  const result = parser.parse(
    createSearchInput({
      query: 'metadata.user.email:"test@example.com"',
    })
  )

  assert.deepEqual(result.expression, {
    kind: "comparison",
    fieldPath: ["metadata", "user", "email"],
    operator: "match",
    quoted: true,
    value: "test@example.com",
  })
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
