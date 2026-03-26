import assert from "node:assert/strict"
import test from "node:test"

import {
  formatUserTimestamp,
  formatUserTimestampWithSeconds,
} from "@/lib/date-time"

test("formatUserTimestamp uses the shared month day time format", () => {
  const value = new Date(2026, 2, 26, 9, 35, 2)

  assert.equal(formatUserTimestamp(value), "Mar 26, 9:35 am")
})

test("formatUserTimestampWithSeconds includes seconds for log views", () => {
  const value = new Date(2026, 2, 26, 9, 35, 2)

  assert.equal(formatUserTimestampWithSeconds(value), "Mar 26, 9:35.02 am")
})
