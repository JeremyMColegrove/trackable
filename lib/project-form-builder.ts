import { z } from "zod"

import type {
  TrackableFormFieldSnapshot,
  TrackableFormSnapshot,
} from "@/db/schema/types"

const fieldKindSchema = z.enum(["rating", "checkboxes", "notes", "short_text"])

const ratingFieldConfigSchema = z.object({
  kind: z.literal("rating"),
  scale: z.int().min(3).max(10),
  icon: z.enum(["star", "thumb", "heart"]).optional(),
  labels: z
    .object({
      low: z.string().trim().max(80).optional(),
      high: z.string().trim().max(80).optional(),
    })
    .optional(),
})

const checkboxOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(80),
})

const checkboxesFieldConfigSchema = z
  .object({
    kind: z.literal("checkboxes"),
    options: z.array(checkboxOptionSchema).min(1, "Add at least one checkbox option."),
    allowOther: z.boolean().optional(),
    minSelections: z.int().min(0).optional(),
    maxSelections: z.int().min(1).optional(),
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
        message: "Maximum selections must be greater than or equal to minimum selections.",
      })
    }

    if (
      typeof value.maxSelections === "number" &&
      value.maxSelections > optionLimit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSelections"],
        message: "Maximum selections cannot exceed the number of available choices.",
      })
    }
  })

const notesFieldConfigSchema = z.object({
  kind: z.literal("notes"),
  placeholder: z.string().trim().max(160).optional(),
  maxLength: z.int().min(1).max(5000).optional(),
})

const shortTextFieldConfigSchema = z.object({
  kind: z.literal("short_text"),
  placeholder: z.string().trim().max(160).optional(),
  maxLength: z.int().min(1).max(500).optional(),
})

const formFieldConfigSchema = z.discriminatedUnion("kind", [
  ratingFieldConfigSchema,
  checkboxesFieldConfigSchema,
  notesFieldConfigSchema,
  shortTextFieldConfigSchema,
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

export function createDefaultEditableForm(projectName?: string): EditableTrackableForm {
  return {
    title: projectName ? `${projectName} feedback form` : "Untitled form",
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
        label: "Quick rating",
        description: "Ask for a fast score.",
        required: true,
        position,
        config: {
          kind,
          scale: 5,
          icon: "star",
          labels: {
            low: "Low",
            high: "High",
          },
        },
      }
    case "checkboxes":
      return {
        id,
        key: createFieldKey("checkboxes", position),
        kind,
        label: "Checkboxes",
        description: "Let people choose one or more options.",
        required: false,
        position,
        config: {
          kind,
          options: [
            createCheckboxOption("Option 1"),
            createCheckboxOption("Option 2"),
          ],
          allowOther: false,
        },
      }
    case "notes":
      return {
        id,
        key: createFieldKey("notes", position),
        kind,
        label: "Notes",
        description: "Collect a written response.",
        required: false,
        position,
        config: {
          kind,
          placeholder: "Share more detail...",
          maxLength: 500,
        },
      }
    case "short_text":
      return {
        id,
        key: createFieldKey("short_text", position),
        kind,
        label: "Short text",
        description: "Collect a short written response.",
        required: false,
        position,
        config: {
          kind,
          placeholder: "Type your answer...",
          maxLength: 120,
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

export function createFieldKey(kind: EditableTrackableFormField["kind"], position: number) {
  return `${kind}_${position + 1}`
}

export function normalizeEditableForm(
  form: EditableTrackableForm
): EditableTrackableForm {
  return {
    ...form,
    title: form.title.trim(),
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
          : field.config,
    })),
  }
}

export function formSnapshotToEditableForm(
  form: Pick<
    TrackableFormSnapshot,
    "title" | "status" | "submitLabel" | "successMessage" | "fields"
  >
): EditableTrackableForm {
  return {
    title: form.title,
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

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}
