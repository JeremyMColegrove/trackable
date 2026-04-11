import { z } from "zod"

import type {
  TrackableFormFieldSnapshot,
  TrackableFormSnapshot,
} from "@/db/schema/types"
import {
  ratingConfigSchema,
  notesConfigSchema,
  shortTextConfigSchema,
  trackableAssetReferenceSchema,
} from "@/lib/form-schemas"
import { extractYouTubeVideoId } from "@/lib/youtube"

const fieldKindSchema = z.enum([
  "rating",
  "checkboxes",
  "notes",
  "short_text",
  "file_upload",
  "youtube_video",
])

// Checkboxes config uses UI-specific error messages and stricter option
// id validation (uuid), so it is defined locally rather than reusing the
// shared checkboxesConfigSchema from lib/form-schemas.
const checkboxOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(80),
})

const checkboxesFieldConfigSchema = z
  .object({
    kind: z.literal("checkboxes"),
    options: z
      .array(checkboxOptionSchema)
      .min(1, "Add at least one checkbox option."),
    allowOther: z.boolean().optional(),
    minSelections: z.number().int().min(0).optional(),
    maxSelections: z.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const optionLimit = value.options.length + (value.allowOther ? 1 : 0)

    if (
      typeof value.minSelections === "number" &&
      typeof value.maxSelections === "number" &&
      value.minSelections > value.maxSelections
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSelections"],
        message:
          "Maximum selections must be greater than or equal to minimum selections.",
      })
    }

    if (
      typeof value.maxSelections === "number" &&
      value.maxSelections > optionLimit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSelections"],
        message:
          "Maximum selections cannot exceed the number of available choices.",
      })
    }
  })

// YouTube config adds a domain-specific refine that is not appropriate in the
// shared data schema, so it is kept local.
const youtubeVideoFieldConfigSchema = z.object({
  kind: z.literal("youtube_video"),
  url: z
    .string()
    .trim()
    .url("Enter a valid YouTube link.")
    .refine(
      (value) => extractYouTubeVideoId(value) !== null,
      "Enter a valid YouTube video link."
    ),
})

const fileUploadFieldConfigSchema = z.object({
  kind: z.literal("file_upload"),
  asset: trackableAssetReferenceSchema.nullable(),
})

const formFieldConfigSchema = z.discriminatedUnion("kind", [
  ratingConfigSchema,
  checkboxesFieldConfigSchema,
  notesConfigSchema,
  shortTextConfigSchema,
  fileUploadFieldConfigSchema,
  youtubeVideoFieldConfigSchema,
])

export const editableTrackableFormFieldSchema = z
  .object({
    id: z.string().uuid(),
    key: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(
        /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
        "Field keys must use lowercase letters, numbers, and underscores."
      ),
    kind: fieldKindSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(280).nullable().optional(),
    required: z.boolean(),
    position: z.int().min(0),
    config: formFieldConfigSchema,
  })
  .superRefine((field, ctx) => {
    if (field.kind !== field.config.kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["config", "kind"],
        message: "Field config must match the selected field type.",
      })
    }
  })

export const editableTrackableFormSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(280).nullable().optional(),
    status: z.enum(["draft", "published", "archived"]),
    submitLabel: z.string().trim().max(60).nullable().optional(),
    successMessage: z.string().trim().max(280).nullable().optional(),
    fields: z.array(editableTrackableFormFieldSchema),
  })
  .superRefine((form, ctx) => {
    if (form.status === "published" && form.fields.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields"],
        message: "Published forms must contain at least one field.",
      })
    }

    const seenKeys = new Set<string>()

    for (const field of form.fields) {
      if (seenKeys.has(field.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields"],
          message: `Field key "${field.key}" must be unique within the form.`,
        })
      }

      seenKeys.add(field.key)
    }
  })

export const createTrackableFormSchema = z.object({
  trackableId: z.string().uuid(),
})

export const saveTrackableFormSchema = z.object({
  trackableId: z.string().uuid(),
  form: editableTrackableFormSchema,
})

export type EditableTrackableForm = z.infer<typeof editableTrackableFormSchema>
export type EditableTrackableFormField = z.infer<
  typeof editableTrackableFormFieldSchema
>

export function createDefaultEditableForm(
  projectName?: string
): EditableTrackableForm {
  return {
    title: projectName ? `${projectName} feedback form` : "Untitled form",
    description: "Fill out the form below and submit your response.",
    status: "draft",
    submitLabel: "Submit response",
    successMessage: "Thanks for your response.",
    fields: [],
  }
}

export function createDefaultEditableField(
  kind: EditableTrackableFormField["kind"],
  position: number
): EditableTrackableFormField {
  const id = crypto.randomUUID()

  switch (kind) {
    case "rating":
      return {
        id,
        key: createFieldKey("rating", position),
        kind,
        label: "How did we do?",
        description: "Rate your experience with this interaction.",
        required: true,
        position,
        config: {
          kind,
          scale: 5,
          icon: "star",
          labels: {
            low: "Needs work",
            high: "Excellent",
          },
        },
      }
    case "checkboxes":
      return {
        id,
        key: createFieldKey("checkboxes", position),
        kind,
        label: "What stood out?",
        description: "Select all of the areas that matched your experience.",
        required: false,
        position,
        config: {
          kind,
          options: [
            createCheckboxOption("Fast response"),
            createCheckboxOption("Clear communication"),
            createCheckboxOption("Problem solved"),
          ],
          allowOther: false,
        },
      }
    case "notes":
      return {
        id,
        key: createFieldKey("notes", position),
        kind,
        label: "Anything else to share?",
        description: "Add any details that would help us improve.",
        required: false,
        position,
        config: {
          kind,
          placeholder:
            "Tell us more about what worked well or what could be better.",
          maxLength: 500,
        },
      }
    case "short_text":
      return {
        id,
        key: createFieldKey("short_text", position),
        kind,
        label: "What should we follow up on?",
        description: "Share a short answer we can review quickly.",
        required: false,
        position,
        config: {
          kind,
          placeholder: "One short answer",
          maxLength: 120,
        },
      }
    case "file_upload":
      return {
        id,
        key: createFieldKey("file_upload", position),
        kind,
        label: "Upload a file",
        description:
          "Responders can upload an image or file with their answer.",
        required: false,
        position,
        config: {
          kind,
          asset: null,
        },
      }
    case "youtube_video":
      return {
        id,
        key: createFieldKey("youtube_video", position),
        kind,
        label: "Watch this quick intro",
        description: "This video is shown directly in the survey.",
        required: false,
        position,
        config: {
          kind,
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      }
  }
}

export function createCheckboxOption(label: string) {
  return {
    id: crypto.randomUUID(),
    label,
    value: createOptionValue(label),
  }
}

export function createOptionValue(label: string) {
  const normalized = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return normalized || `option_${Math.random().toString(36).slice(2, 8)}`
}

export function createFieldKey(
  kind: EditableTrackableFormField["kind"],
  position: number
) {
  return `${kind}_${position + 1}`
}

export function normalizeEditableForm(
  form: EditableTrackableForm
): EditableTrackableForm {
  return {
    ...form,
    title: form.title.trim(),
    description: normalizeOptionalText(form.description),
    submitLabel: normalizeOptionalText(form.submitLabel),
    successMessage: normalizeOptionalText(form.successMessage),
    fields: form.fields.map((field, index) => ({
      ...field,
      key: field.key.trim(),
      label: field.label.trim(),
      description: normalizeOptionalText(field.description),
      position: index,
      config:
        field.config.kind === "checkboxes"
          ? {
              ...field.config,
              options: field.config.options.map((option) => ({
                ...option,
                label: option.label.trim(),
                value: option.value.trim(),
              })),
            }
          : field.config.kind === "youtube_video"
            ? {
                ...field.config,
                url: field.config.url.trim(),
              }
            : field.config,
    })),
  }
}

export function formSnapshotToEditableForm(
  form: Pick<
    TrackableFormSnapshot,
    | "title"
    | "description"
    | "status"
    | "submitLabel"
    | "successMessage"
    | "fields"
  >
): EditableTrackableForm {
  return {
    title: form.title,
    description: form.description,
    status: form.status,
    submitLabel: form.submitLabel,
    successMessage: form.successMessage,
    fields: [...form.fields]
      .sort((left, right) => left.position - right.position)
      .map((field, index) => ({
        ...field,
        description: field.description,
        position: index,
      })),
  }
}

export function formFieldToSnapshot(
  field: EditableTrackableFormField,
  position: number
): TrackableFormFieldSnapshot {
  return {
    id: field.id,
    key: field.key,
    kind: field.kind,
    label: field.label,
    description: field.description ?? null,
    required: field.required,
    position,
    config: field.config,
  }
}

export function editableFormToSnapshot(
  form: EditableTrackableForm,
  options?: {
    id?: string
    version?: number
  }
): TrackableFormSnapshot {
  const normalizedForm = normalizeEditableForm(form)

  return {
    id: options?.id ?? `preview-${crypto.randomUUID()}`,
    version: options?.version ?? 0,
    title: normalizedForm.title,
    description: normalizedForm.description ?? null,
    status: normalizedForm.status,
    submitLabel: normalizedForm.submitLabel ?? null,
    successMessage: normalizedForm.successMessage ?? null,
    fields: normalizedForm.fields.map((field, index) =>
      formFieldToSnapshot(field, index)
    ),
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}
