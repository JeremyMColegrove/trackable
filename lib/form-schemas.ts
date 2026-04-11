import { z } from "zod"

// ---------------------------------------------------------------------------
// Supporting schemas
// ---------------------------------------------------------------------------

export const checkboxOptionSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(80),
})

export type CheckboxOption = z.infer<typeof checkboxOptionSchema>

export const trackableAssetReferenceSchema = z.object({
  id: z.string().uuid(),
  publicToken: z.string().trim().min(1),
  kind: z.enum(["image", "file"]),
  originalFileName: z.string().trim().min(1).max(120),
  mimeType: z.string().trim().min(1).max(255),
  imageWidth: z.number().int().nullable(),
  imageHeight: z.number().int().nullable(),
})

export type TrackableAssetReference = z.infer<
  typeof trackableAssetReferenceSchema
>

// ---------------------------------------------------------------------------
// Field config schemas
// ---------------------------------------------------------------------------

export const ratingConfigSchema = z.object({
  kind: z.literal("rating"),
  scale: z.number().int().min(3).max(10),
  icon: z.enum(["star", "thumb", "heart"]).optional(),
  labels: z
    .object({
      low: z.string().trim().max(80).optional(),
      high: z.string().trim().max(80).optional(),
    })
    .optional(),
})

export const checkboxesConfigSchema = z
  .object({
    kind: z.literal("checkboxes"),
    options: z.array(checkboxOptionSchema),
    allowOther: z.boolean().optional(),
    minSelections: z.number().int().min(0).optional(),
    maxSelections: z.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      typeof value.minSelections === "number" &&
      typeof value.maxSelections === "number" &&
      value.minSelections > value.maxSelections
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSelections"],
        message: "maxSelections must be >= minSelections",
      })
    }
    const optionLimit = value.options.length + (value.allowOther ? 1 : 0)
    if (
      typeof value.maxSelections === "number" &&
      value.maxSelections > optionLimit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSelections"],
        message: "maxSelections cannot exceed the number of available choices",
      })
    }
  })

export const notesConfigSchema = z.object({
  kind: z.literal("notes"),
  placeholder: z.string().trim().max(160).optional(),
  maxLength: z.number().int().min(1).max(5000).optional(),
})

export const shortTextConfigSchema = z.object({
  kind: z.literal("short_text"),
  placeholder: z.string().trim().max(160).optional(),
  maxLength: z.number().int().min(1).max(500).optional(),
})

export const fileUploadConfigSchema = z.object({
  kind: z.literal("file_upload"),
  asset: trackableAssetReferenceSchema.nullable(),
})

export const youtubeVideoConfigSchema = z.object({
  kind: z.literal("youtube_video"),
  url: z.string().url(),
})

export const formFieldConfigSchema = z.discriminatedUnion("kind", [
  ratingConfigSchema,
  checkboxesConfigSchema,
  notesConfigSchema,
  shortTextConfigSchema,
  fileUploadConfigSchema,
  youtubeVideoConfigSchema,
])

export type RatingFieldConfig = z.infer<typeof ratingConfigSchema>
export type CheckboxesFieldConfig = z.infer<typeof checkboxesConfigSchema>
export type NotesFieldConfig = z.infer<typeof notesConfigSchema>
export type ShortTextFieldConfig = z.infer<typeof shortTextConfigSchema>
export type FileUploadFieldConfig = z.infer<typeof fileUploadConfigSchema>
export type YouTubeVideoFieldConfig = z.infer<typeof youtubeVideoConfigSchema>
export type FormFieldConfig = z.infer<typeof formFieldConfigSchema>

// ---------------------------------------------------------------------------
// Answer value schema
// ---------------------------------------------------------------------------

export const formAnswerValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rating"), value: z.number() }),
  z.object({ kind: z.literal("checkboxes"), value: z.array(z.string()) }),
  z.object({ kind: z.literal("notes"), value: z.string() }),
  z.object({ kind: z.literal("short_text"), value: z.string() }),
])

export type FormAnswerValue = z.infer<typeof formAnswerValueSchema>

// ---------------------------------------------------------------------------
// Form snapshot schemas
// ---------------------------------------------------------------------------

export const trackableFormFieldSnapshotSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  kind: z.enum([
    "rating",
    "checkboxes",
    "notes",
    "short_text",
    "file_upload",
    "youtube_video",
  ]),
  label: z.string(),
  description: z.string().nullable(),
  required: z.boolean(),
  position: z.number().int(),
  config: formFieldConfigSchema,
})

export const trackableFormSnapshotSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  submitLabel: z.string().nullable(),
  successMessage: z.string().nullable(),
  fields: z.array(trackableFormFieldSnapshotSchema),
})

export const trackableFormAnswerSnapshotSchema = z.object({
  fieldId: z.string().uuid(),
  fieldKey: z.string(),
  fieldKind: z.enum(["rating", "checkboxes", "notes", "short_text"]),
  fieldLabel: z.string(),
  value: formAnswerValueSchema,
})

export const trackableSubmissionSnapshotSchema = z.object({
  form: trackableFormSnapshotSchema,
  answers: z.array(trackableFormAnswerSnapshotSchema),
})

export type TrackableFormFieldSnapshot = z.infer<
  typeof trackableFormFieldSnapshotSchema
>
export type TrackableFormSnapshot = z.infer<typeof trackableFormSnapshotSchema>
export type TrackableFormAnswerSnapshot = z.infer<
  typeof trackableFormAnswerSnapshotSchema
>
export type TrackableSubmissionSnapshot = z.infer<
  typeof trackableSubmissionSnapshotSchema
>
