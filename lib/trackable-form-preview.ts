import type { TrackableFormSnapshot } from "@/db/schema/types"
import {
  editableFormToSnapshot,
  editableTrackableFormSchema,
  normalizeEditableForm,
  type EditableTrackableForm,
} from "@/lib/project-form-builder"

const trackableFormPreviewStoragePrefix = "trackable-form-preview"

type StoredTrackableFormPreview = {
  trackableId: string
  form: EditableTrackableForm
}

export function createTrackableFormPreviewId() {
  return crypto.randomUUID()
}

export function buildTrackableFormPreviewStorageKey(previewId: string) {
  return `${trackableFormPreviewStoragePrefix}:${previewId}`
}

export function storeTrackableFormPreview({
  previewId,
  trackableId,
  form,
}: {
  previewId: string
  trackableId: string
  form: EditableTrackableForm
}) {
  if (typeof window === "undefined") {
    return
  }

  const normalizedForm = normalizeEditableForm(form)
  const result = editableTrackableFormSchema.safeParse(normalizedForm)

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ?? "Unable to prepare the preview."
    )
  }

  const payload: StoredTrackableFormPreview = {
    trackableId,
    form: result.data,
  }

  window.localStorage.setItem(
    buildTrackableFormPreviewStorageKey(previewId),
    JSON.stringify(payload)
  )
}

export function loadTrackableFormPreview({
  previewId,
  trackableId,
  fallbackFormId,
  fallbackVersion,
}: {
  previewId: string
  trackableId: string
  fallbackFormId?: string
  fallbackVersion?: number
}): TrackableFormSnapshot | null {
  if (typeof window === "undefined") {
    return null
  }

  const storedValue = window.localStorage.getItem(
    buildTrackableFormPreviewStorageKey(previewId)
  )

  if (!storedValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(storedValue) as StoredTrackableFormPreview

    if (parsedValue.trackableId !== trackableId) {
      return null
    }

    const result = editableTrackableFormSchema.safeParse(parsedValue.form)

    if (!result.success) {
      return null
    }

    return editableFormToSnapshot(result.data, {
      id: fallbackFormId,
      version: fallbackVersion,
    })
  } catch {
    return null
  }
}
