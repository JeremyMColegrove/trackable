import assert from "node:assert/strict"
import test from "node:test"
import * as chrono from "chrono-node"

import { parseDateRange } from "../utils/parse-date-range"

const fixedNow = new Date(2026, 2, 24, 9, 0, 0)

test("parseDateRange parses relative ranges ending at now", () => {
  const result = parseDateRange("past 15 minutes", { now: fixedNow })

  assert.equal(result.ok, true)

  if (!result.ok) {
    return
  }

  assert.equal(result.value.start.getTime(), new Date(2026, 2, 24, 8, 45, 0).getTime())
  assert.equal(result.value.end.getTime(), fixedNow.getTime())
  assert.equal(result.value.source, "custom")
})

test("parseDateRange recognizes all time as a preset", () => {
  const result = parseDateRange("all time", { now: fixedNow })

  assert.equal(result.ok, true)

  if (!result.ok) {
    return
  }

  assert.equal(result.value.source, "preset")
  assert.equal(result.value.presetKey, "all_time")
  assert.equal(result.value.end.getTime(), fixedNow.getTime())
})

test("parseDateRange parses explicit typed ranges and swaps reversed values", () => {
  const result = parseDateRange("2026-03-24 09:00 -> 2026-03-20 09:00", {
    now: fixedNow,
  })

  assert.equal(result.ok, true)

  if (!result.ok) {
    return
  }

  assert.equal(result.value.start.getTime(), new Date(2026, 2, 20, 9, 0, 0).getTime())
  assert.equal(result.value.end.getTime(), new Date(2026, 2, 24, 9, 0, 0).getTime())
})

test("parseDateRange uses chrono-node dates for split inputs", () => {
  const result = parseDateRange("march 1 - march 3 9am", { now: fixedNow })

  assert.equal(result.ok, true)

  if (!result.ok) {
    return
  }

  assert.equal(
    result.value.start.getTime(),
    chrono.parseDate("march 1", fixedNow)?.getTime()
  )
  assert.equal(
    result.value.end.getTime(),
    chrono.parseDate("march 3 9am", fixedNow)?.getTime()
  )
})

test("parseDateRange handles natural language intervals", () => {
  const result = parseDateRange("from last monday 9am to friday 5pm", {
    now: new Date(2026, 2, 28, 9, 0, 0),
  })

  assert.equal(result.ok, true)

  if (!result.ok) {
    return
  }

  assert.equal(result.value.start.getTime(), new Date(2026, 2, 23, 9, 0, 0).getTime())
  assert.equal(result.value.end.getTime(), new Date(2026, 2, 27, 17, 0, 0).getTime())
})

test("parseDateRange rejects future ranges by default", () => {
  const result = parseDateRange("tomorrow 9am to tomorrow 10am", {
    now: fixedNow,
  })

  assert.deepEqual(result, {
    ok: false,
    error: "Future dates are not allowed.",
  })
})

test("parseDateRange fails clearly for invalid input", () => {
  const result = parseDateRange("definitely not a date range", {
    now: fixedNow,
  })

  assert.equal(result.ok, false)

  if (result.ok) {
    return
  }

  assert.match(result.error, /Could not parse/)
})
