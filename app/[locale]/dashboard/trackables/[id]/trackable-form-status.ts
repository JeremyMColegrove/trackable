import type { TrackableFormSnapshot } from "@/db/schema/types"

export function hasConfiguredTrackableForm(
  form: Pick<TrackableFormSnapshot, "fields"> | null
) {
  return Boolean(form && form.fields.length > 0)
}
