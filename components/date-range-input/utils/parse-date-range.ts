import * as chrono from "chrono-node"

import { getAllTimeStart } from "./presets"
import type { ParseDateRangeOptions, ParseDateRangeResult } from "./types"

const RANGE_SPLITTERS = [/\s+to\s+/i, /\s*->\s*/i, /\s*→\s*/i, /\s+-\s+/]

function finalizeRange(
  start: Date,
  end: Date,
  rawInput: string,
  options: ParseDateRangeOptions
): ParseDateRangeResult {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Enter a complete date range." }
  }

  const now = options.now ?? new Date()
  const allowFuture = options.allowFuture ?? false
  let nextStart = new Date(start)
  let nextEnd = new Date(end)

  if (nextStart.getTime() > nextEnd.getTime()) {
    ;[nextStart, nextEnd] = [nextEnd, nextStart]
  }

  if (!allowFuture && nextEnd.getTime() > now.getTime()) {
    return { ok: false, error: "Future dates are not allowed." }
  }

  return {
    ok: true,
    value: {
      start: nextStart,
      end: nextEnd,
      source: "custom",
      rawInput,
    },
  }
}

function parseSplitRange(
  input: string,
  options: ParseDateRangeOptions
): ParseDateRangeResult | null {
  const now = options.now ?? new Date()

  for (const splitter of RANGE_SPLITTERS) {
    const match = splitter.exec(input)

    if (!match || match.index === undefined) {
      continue
    }

    const left = input.slice(0, match.index).trim()
    const right = input.slice(match.index + match[0].length).trim()
    const start = chrono.parseDate(left, now)
    const end = chrono.parseDate(right, now)

    if (!start || !end) {
      return {
        ok: false,
        error: "Enter both a start and end date/time.",
      }
    }

    return finalizeRange(start, end, input, options)
  }

  return null
}

export function parseDateRange(
  input: string,
  options: ParseDateRangeOptions = {}
): ParseDateRangeResult {
  const trimmedInput = input.trim()

  if (!trimmedInput) {
    return { ok: false, error: "Enter a date range." }
  }

  if (trimmedInput.toLowerCase() === "all time") {
    const now = options.now ?? new Date()

    return {
      ok: true,
      value: {
        start: getAllTimeStart(),
        end: new Date(now),
        source: "preset",
        presetKey: "all_time",
        rawInput: trimmedInput,
      },
    }
  }

  const splitRange = parseSplitRange(trimmedInput, options)

  if (splitRange) {
    return splitRange
  }

  const now = options.now ?? new Date()
  const parsed = chrono.parse(trimmedInput, now)[0]

  if (!parsed?.start) {
    return {
      ok: false,
      error:
        "Could not parse that range. Try “past 15 minutes” or “2026-03-20 09:00 -> 2026-03-24 09:00”.",
    }
  }

  const end = parsed.end?.date() ?? new Date(now)

  return finalizeRange(parsed.start.date(), end, trimmedInput, options)
}
