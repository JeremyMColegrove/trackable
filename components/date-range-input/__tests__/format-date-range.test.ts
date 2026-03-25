import assert from "node:assert/strict"
import test from "node:test"

import {
  formatDateRangeDurationBadge,
  formatDurationBadge,
} from "../utils/duration"
import {
  formatBlurredDateRangeValue,
  formatCompactDateRange,
  formatExpandedDateRange,
} from "../utils/format-date-range"
import { defaultDateRangePresets } from "../utils/presets"
import type { DateRangeValue } from "../utils/types"

test("formatExpandedDateRange uses a compact readable date-time format", () => {
  const value: DateRangeValue = {
    start: new Date(2026, 2, 20, 9, 0, 0),
    end: new Date(2026, 2, 24, 9, 0, 0),
    source: "custom",
  }

  assert.equal(
    formatExpandedDateRange(value),
    "Mar 20, 9:00 am - Mar 24, 9:00 am"
  )
})

test("formatBlurredDateRangeValue prefers the preset label when one is selected", () => {
  const value: DateRangeValue = {
    start: new Date(2026, 2, 20, 9, 0, 0),
    end: new Date(2026, 2, 24, 9, 0, 0),
    source: "preset",
    presetKey: "past_4_days",
  }

  assert.equal(
    formatBlurredDateRangeValue(value, defaultDateRangePresets),
    "Past 4 days"
  )
})

test("formatBlurredDateRangeValue shows all time for the all_time preset", () => {
  const value: DateRangeValue = {
    start: new Date(1970, 0, 1, 0, 0, 0),
    end: new Date(2026, 2, 24, 9, 0, 0),
    source: "preset",
    presetKey: "all_time",
  }

  assert.equal(
    formatBlurredDateRangeValue(value, defaultDateRangePresets),
    "All time"
  )
})

test("formatCompactDateRange keeps custom ranges readable when blurred", () => {
  const value: DateRangeValue = {
    start: new Date(2026, 2, 20, 9, 0, 0),
    end: new Date(2026, 2, 24, 9, 0, 0),
    source: "custom",
  }

  assert.equal(formatCompactDateRange(value), "Mar 20, 9:00 am - Mar 24, 9:00 am")
})

test("formatDurationBadge returns compact duration badges", () => {
  assert.equal(formatDurationBadge(5 * 60 * 1000), "5m")
  assert.equal(formatDurationBadge(60 * 60 * 1000), "1h")
  assert.equal(formatDurationBadge(3 * 24 * 60 * 60 * 1000), "3d")
  assert.equal(formatDurationBadge(14 * 24 * 60 * 60 * 1000), "2w")
})

test("formatDateRangeDurationBadge returns infinity for all time", () => {
  const value: DateRangeValue = {
    start: new Date(1970, 0, 1, 0, 0, 0),
    end: new Date(2026, 2, 24, 9, 0, 0),
    source: "preset",
    presetKey: "all_time",
  }

  assert.equal(formatDateRangeDurationBadge(value), "∞")
})
