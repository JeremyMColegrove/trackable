import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS } from "./duration"
import type { DateRangePreset } from "./types"

export function getAllTimeStart() {
  const date = new Date(0)
  date.setMinutes(date.getMinutes() + date.getTimezoneOffset())
  return date
}

function createRelativePreset(
  key: string,
  label: string,
  durationMs: number
): DateRangePreset {
  return {
    key,
    label,
    getRange(now) {
      return {
        start: new Date(now.getTime() - durationMs),
        end: new Date(now),
      }
    },
  }
}

export const defaultDateRangePresets: DateRangePreset[] = [
  {
    key: "all_time",
    label: "All time",
    getRange(now) {
      return {
        start: getAllTimeStart(),
        end: new Date(now),
      }
    },
  },
  createRelativePreset("past_5_minutes", "Past 5 minutes", 5 * MINUTE_IN_MS),
  createRelativePreset("past_15_minutes", "Past 15 minutes", 15 * MINUTE_IN_MS),
  createRelativePreset("past_30_minutes", "Past 30 minutes", 30 * MINUTE_IN_MS),
  createRelativePreset("past_1_hour", "Past 1 hour", HOUR_IN_MS),
  createRelativePreset("past_2_hours", "Past 2 hours", 2 * HOUR_IN_MS),
  createRelativePreset("past_4_hours", "Past 4 hours", 4 * HOUR_IN_MS),
  createRelativePreset("past_6_hours", "Past 6 hours", 6 * HOUR_IN_MS),
  createRelativePreset("past_12_hours", "Past 12 hours", 12 * HOUR_IN_MS),
  createRelativePreset("past_1_day", "Past 1 day", DAY_IN_MS),
  createRelativePreset("past_2_days", "Past 2 days", 2 * DAY_IN_MS),
  createRelativePreset("past_4_days", "Past 4 days", 4 * DAY_IN_MS),
  createRelativePreset("past_7_days", "Past 7 days", 7 * DAY_IN_MS),
  createRelativePreset("past_14_days", "Past 14 days", 14 * DAY_IN_MS),
  createRelativePreset("past_30_days", "Past 30 days", 30 * DAY_IN_MS),
  createRelativePreset("past_90_days", "Past 90 days", 90 * DAY_IN_MS),
]

export function getPresetByKey(
  presets: DateRangePreset[],
  presetKey?: string
) {
  if (!presetKey) {
    return null
  }

  return presets.find((preset) => preset.key === presetKey) ?? null
}
