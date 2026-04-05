import type { TrackableKind, TrackableSettings } from "@/db/schema/types"

export function getDefaultTrackableSettings(input: {
  kind: TrackableKind
  maxLogRetentionDays: number | null
}): TrackableSettings | undefined {
  if (input.kind !== "api_ingestion") {
    return undefined
  }

  return {
    apiLogRetentionDays:
      input.maxLogRetentionDays === null
        ? null
        : (input.maxLogRetentionDays as 3 | 7 | 30 | 90),
  }
}
