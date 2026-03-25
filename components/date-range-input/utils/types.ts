export type DateRangeSource = "preset" | "custom"

export type DateRangeValue = {
  start: Date
  end: Date
  source: DateRangeSource
  presetKey?: string
  rawInput?: string
}

export type DateRangePreset = {
  key: string
  label: string
  getRange: (now: Date) => Pick<DateRangeValue, "start" | "end">
}

export type DateRangeCommitReason = "preset" | "enter" | "blur" | "clear"

export type DateRangeChangeMeta = {
  reason: DateRangeCommitReason
  previousValue: DateRangeValue | null
  draft: string
}

export type ParseDateRangeOptions = {
  allowFuture?: boolean
  now?: Date
}

export type ParseDateRangeSuccess = {
  ok: true
  value: DateRangeValue
}

export type ParseDateRangeFailure = {
  ok: false
  error: string
}

export type ParseDateRangeResult =
  | ParseDateRangeSuccess
  | ParseDateRangeFailure

export function normalizeDateRangeValue(
  value: DateRangeValue
): DateRangeValue {
  if (value.start.getTime() <= value.end.getTime()) {
    return value
  }

  return {
    ...value,
    start: value.end,
    end: value.start,
  }
}
