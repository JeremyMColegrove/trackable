import assert from "node:assert/strict"
import test from "node:test"

import { getNextDateRangeSelection } from "../utils/date-range-selection"

const value = "Mar 24, 4:30 pm - Mar 24, 5:30 pm"

test("left arrow selection walks backward across date-time segments", () => {
  const meridiem = getNextDateRangeSelection(value, value.length, value.length, "left")

  assert.deepEqual(meridiem, { start: 31, end: 33 })

  const minute = getNextDateRangeSelection(
    value,
    meridiem?.start ?? 0,
    meridiem?.end ?? 0,
    "left"
  )

  assert.deepEqual(minute, { start: 28, end: 30 })

  const hour = getNextDateRangeSelection(
    value,
    minute?.start ?? 0,
    minute?.end ?? 0,
    "left"
  )

  assert.deepEqual(hour, { start: 26, end: 27 })

  const day = getNextDateRangeSelection(
    value,
    hour?.start ?? 0,
    hour?.end ?? 0,
    "left"
  )

  assert.deepEqual(day, { start: 22, end: 24 })

  const month = getNextDateRangeSelection(
    value,
    day?.start ?? 0,
    day?.end ?? 0,
    "left"
  )

  assert.deepEqual(month, { start: 18, end: 21 })
})

test("right arrow selection walks forward across date-time segments", () => {
  const monthDay = getNextDateRangeSelection(value, 0, 0, "right")

  assert.deepEqual(monthDay, { start: 0, end: 3 })

  const day = getNextDateRangeSelection(
    value,
    monthDay?.start ?? 0,
    monthDay?.end ?? 0,
    "right"
  )

  assert.deepEqual(day, { start: 4, end: 6 })
})

test("right arrow collapses the last selected token to a caret", () => {
  const collapsed = getNextDateRangeSelection(value, 31, 33, "right")

  assert.deepEqual(collapsed, { start: 33, end: 33 })
})

test("left arrow collapses the first selected token to a caret", () => {
  const collapsed = getNextDateRangeSelection(value, 0, 3, "left")

  assert.deepEqual(collapsed, { start: 0, end: 0 })
})
