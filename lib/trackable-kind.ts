import type { TrackableKind } from "@/db/schema/types"

const trackableKindLabels = {
  survey: {
    short: "Survey",
    creation: "Survey",
  },
  api_ingestion: {
    short: "Logs",
    creation: "Log ingestion",
  },
} satisfies Record<
  TrackableKind,
  {
    short: string
    creation: string
  }
>

export function getTrackableKindShortLabel(kind: TrackableKind) {
  return trackableKindLabels[kind].short
}

export function getTrackableKindCreationLabel(kind: TrackableKind) {
  return trackableKindLabels[kind].creation
}
