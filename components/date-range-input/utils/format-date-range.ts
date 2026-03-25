import { getPresetByKey } from "./presets"
import {
  normalizeDateRangeValue,
  type DateRangePreset,
  type DateRangeValue,
} from "./types"

const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
})

function padNumber(value: number) {
  return String(value).padStart(2, "0")
}

function formatTime(date: Date) {
  const rawHours = date.getHours()
  const hours = rawHours % 12 || 12
  const meridiem = rawHours >= 12 ? "pm" : "am"

  return `${hours}:${padNumber(date.getMinutes())} ${meridiem}`
}

function formatMonthDay(date: Date) {
  return `${shortMonthFormatter.format(date)} ${date.getDate()}`
}

function formatMonthDayYear(date: Date) {
  return `${formatMonthDay(date)}, ${date.getFullYear()}`
}

function isSameYear(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
}

function formatDateTime(date: Date, includeYear: boolean) {
  const dateLabel = includeYear ? formatMonthDayYear(date) : formatMonthDay(date)

  return `${dateLabel}, ${formatTime(date)}`
}

export function formatExpandedDateTime(date: Date, includeYear = false) {
  return formatDateTime(date, includeYear)
}

export function formatExpandedDateRange(value: DateRangeValue) {
  const normalizedValue = normalizeDateRangeValue(value)
  const includeYear = !isSameYear(normalizedValue.start, normalizedValue.end)

  return `${formatExpandedDateTime(normalizedValue.start, includeYear)} - ${formatExpandedDateTime(normalizedValue.end, includeYear)}`
}

export function formatCompactDateRange(value: DateRangeValue) {
  return formatExpandedDateRange(value)
}

export function formatBlurredDateRangeValue(
  value: DateRangeValue,
  presets: DateRangePreset[]
) {
  const preset = getPresetByKey(presets, value.presetKey)

  if (value.source === "preset" && preset) {
    return preset.label
  }

  return formatCompactDateRange(value)
}
