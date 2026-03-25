import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAppliedUsageEventTimeRangeUrlState,
  buildUsageEventSearchInput,
  buildUsageEventUrlSearchParams,
  createUsageEventComputedColumnId,
  parseUsageEventVisibleColumnIds,
  stringifyUsageEventVisibleColumnIds,
} from "@/lib/usage-event-search"

test("buildAppliedUsageEventTimeRangeUrlState preserves exact applied bounds", () => {
  assert.deepEqual(
    buildAppliedUsageEventTimeRangeUrlState({
      from: "2026-03-24T10:00:00.000Z",
      to: "2026-03-24T11:00:00.000Z",
    }),
    {
      range: "custom",
      from: "2026-03-24T10:00:00.000Z",
      to: "2026-03-24T11:00:00.000Z",
    }
  )
})

test("drill-down URL params keep the concrete time range used for the grouped table", () => {
  const appliedSearchInput = buildUsageEventSearchInput(
    "123e4567-e89b-42d3-a456-426614174000",
    {
      q: "event:signup",
      aggregate: "plan",
      range: "last_24_hours",
      limit: "50",
    }
  )

  const nextParams = buildUsageEventUrlSearchParams({
    q: "plan:=pro",
    aggregate: undefined,
    limit: "50",
    ...buildAppliedUsageEventTimeRangeUrlState(appliedSearchInput),
  })

  assert.equal(nextParams.get("q"), "plan:=pro")
  assert.equal(nextParams.get("range"), "custom")
  assert.equal(nextParams.get("from"), appliedSearchInput.from)
  assert.equal(nextParams.get("to"), appliedSearchInput.to)
})

test("usage event visible columns round-trip through the compact URL format", () => {
  const columnIds = [
    "lastOccurredAt",
    "event",
    createUsageEventComputedColumnId("route"),
    createUsageEventComputedColumnId("release,version"),
  ] as const

  const serialized = stringifyUsageEventVisibleColumnIds([...columnIds])

  assert.equal(
    serialized,
    "lastOccurredAt,event,k%3Aroute,k%3Arelease%2Cversion"
  )
  assert.deepEqual(parseUsageEventVisibleColumnIds(serialized), columnIds)
})

test("usage event visible column parsing drops invalid and duplicate values", () => {
  assert.deepEqual(
    parseUsageEventVisibleColumnIds(
      "event,event,invalid,k%3Aroute,k%3Aroute,k%3A%20"
    ),
    ["event", createUsageEventComputedColumnId("route")]
  )
})
