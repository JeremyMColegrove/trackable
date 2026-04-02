"use client"

import { StatusPageCard } from "@/components/status-page-card"
import type { TrackableFormSnapshot } from "@/db/schema/types"
import { loadTrackableFormPreview } from "@/lib/trackable-form-preview"
import { T, useGT } from "gt-next"
import { AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"
import type {
  SharedSettings,
  SharedTrackable,
} from "@/app/[locale]/share/[token]/shared-form-card"
import { SharedFormCard } from "@/app/[locale]/share/[token]/shared-form-card"

export function TrackablePreviewPage({
  previewId,
  trackable,
  initialForm,
}: {
  previewId?: string
  trackable: SharedTrackable
  initialForm: TrackableFormSnapshot | null
}) {
  const gt = useGT()
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    if (!previewId) {
      setForm(initialForm)
      return
    }

    const previewForm = loadTrackableFormPreview({
      previewId,
      trackableId: trackable.id,
      fallbackFormId: initialForm?.id,
      fallbackVersion: initialForm?.version,
    })

    setForm(previewForm ?? initialForm)
  }, [initialForm, previewId, trackable.id])

  if (!form) {
    return (
      <StatusPageCard
        badge={<T>Preview</T>}
        title={gt("Preview unavailable")}
        description={gt(
          "Save a survey version or open preview from the form builder to load a draft preview."
        )}
        icon={AlertCircle}
        variant="error"
      />
    )
  }

  const previewSettings: SharedSettings = {
    allowAnonymousSubmissions: false,
    collectResponderEmail: false,
    requiresAuthentication: true,
  }

  return (
    <SharedFormCard
      initialHasSubmitted={false}
      isAnonymousVisitor={false}
      trackable={trackable}
      form={form}
      settings={previewSettings}
      mode="preview"
    />
  )
}
