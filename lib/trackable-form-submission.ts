import { z } from "zod"

import type {
  CheckboxesFieldConfig,
  FormAnswerValue,
  FormFieldConfig,
  NotesFieldConfig,
  RatingFieldConfig,
  ShortTextFieldConfig,
  TrackableFormFieldSnapshot,
  TrackableFormSnapshot,
  TrackableSubmissionSnapshot,
  YouTubeVideoFieldConfig,
} from "@/db/schema/types"

const otherCheckboxValue = "__other__"

export const publicFormSubmissionSchema = z.object({
  token: z.string().trim().min(1),
  responderEmail: z.string().trim().email().optional(),
  metadata: z
    .object({
      locale: z.string().trim().max(40).optional(),
      userAgent: z.string().trim().max(512).optional(),
      referrer: z.string().trim().max(1024).optional(),
    })
    .optional(),
  answers: z.array(
    z.object({
      fieldId: z.string().uuid(),
      value: z.unknown(),
    })
  ),
})

export type PublicFormSubmissionInput = z.infer<
  typeof publicFormSubmissionSchema
>

type SubmissionAnswer = TrackableSubmissionSnapshot["answers"][number]
type AnswerableTrackableFormField = TrackableFormFieldSnapshot & {
  kind: Exclude<FormFieldConfig["kind"], "youtube_video">
  config: Exclude<FormFieldConfig, { kind: "youtube_video" }>
}

export function isRatingField(
  field: TrackableFormFieldSnapshot
): field is TrackableFormFieldSnapshot & {
  kind: "rating"
  config: RatingFieldConfig
} {
  return field.kind === "rating" && field.config.kind === "rating"
}

export function isCheckboxesField(
  field: TrackableFormFieldSnapshot
): field is TrackableFormFieldSnapshot & {
  kind: "checkboxes"
  config: CheckboxesFieldConfig
} {
  return field.kind === "checkboxes" && field.config.kind === "checkboxes"
}

export function isNotesField(
  field: TrackableFormFieldSnapshot
): field is TrackableFormFieldSnapshot & {
  kind: "notes"
  config: NotesFieldConfig
} {
  return field.kind === "notes" && field.config.kind === "notes"
}

export function isShortTextField(
  field: TrackableFormFieldSnapshot
): field is TrackableFormFieldSnapshot & {
  kind: "short_text"
  config: ShortTextFieldConfig
} {
  return field.kind === "short_text" && field.config.kind === "short_text"
}

export function isYouTubeVideoField(
  field: TrackableFormFieldSnapshot
): field is TrackableFormFieldSnapshot & {
  kind: "youtube_video"
  config: YouTubeVideoFieldConfig
} {
  return field.kind === "youtube_video" && field.config.kind === "youtube_video"
}

export function isAnswerableField(
  field: TrackableFormFieldSnapshot
): field is AnswerableTrackableFormField {
  return !isYouTubeVideoField(field)
}

export function buildSubmissionSnapshot(
  form: TrackableFormSnapshot,
  answers: PublicFormSubmissionInput["answers"]
) {
  const fields = [...form.fields].sort(
    (left, right) => left.position - right.position
  )
  const answerableFields = fields.filter(isAnswerableField)
  const answersByFieldId = new Map<string, unknown>()

  for (const answer of answers) {
    if (answersByFieldId.has(answer.fieldId)) {
      throw new Error("Duplicate answers are not allowed.")
    }

    answersByFieldId.set(answer.fieldId, answer.value)
  }

  const normalizedAnswers = answerableFields.map((field) =>
    buildFieldAnswer(field, answersByFieldId.get(field.id))
  )

  return {
    snapshot: {
      form: {
        ...form,
        fields,
      },
      answers: normalizedAnswers,
    } satisfies TrackableSubmissionSnapshot,
    answers: normalizedAnswers.map((answer) => ({
      fieldId: answer.fieldId,
      value: answer.value,
    })),
  }
}

export function requiresResponderEmail(
  settings: {
    allowAnonymousSubmissions?: boolean
    collectResponderEmail?: boolean
  } | null
) {
  return settings?.collectResponderEmail === true
}

function buildFieldAnswer(
  field: AnswerableTrackableFormField,
  rawValue: unknown
): SubmissionAnswer {
  if (isRatingField(field)) {
    return {
      fieldId: field.id,
      fieldKey: field.key,
      fieldKind: field.kind,
      fieldLabel: field.label,
      value: {
        kind: "rating",
        value: parseRatingValue(field, rawValue),
      },
    }
  }

  if (isCheckboxesField(field)) {
    return {
      fieldId: field.id,
      fieldKey: field.key,
      fieldKind: field.kind,
      fieldLabel: field.label,
      value: {
        kind: "checkboxes",
        value: parseCheckboxValues(field, rawValue),
      },
    }
  }

  if (isNotesField(field)) {
    return {
      fieldId: field.id,
      fieldKey: field.key,
      fieldKind: field.kind,
      fieldLabel: field.label,
      value: {
        kind: "notes",
        value: parseTextValue(field, rawValue),
      },
    }
  }

  if (isShortTextField(field)) {
    return {
      fieldId: field.id,
      fieldKey: field.key,
      fieldKind: field.kind,
      fieldLabel: field.label,
      value: {
        kind: "short_text",
        value: parseTextValue(field, rawValue),
      },
    }
  }

  throw new Error(`Unsupported field type for ${field.label}.`)
}

function parseRatingValue(
  field: TrackableFormFieldSnapshot & {
    kind: "rating"
    config: RatingFieldConfig
  },
  rawValue: unknown
) {
  if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) {
    throw new Error(`${field.label} requires a valid rating.`)
  }

  if (rawValue < 1 || rawValue > field.config.scale) {
    throw new Error(
      `${field.label} must be between 1 and ${field.config.scale}.`
    )
  }

  return rawValue
}

function parseCheckboxValues(
  field: TrackableFormFieldSnapshot & {
    kind: "checkboxes"
    config: CheckboxesFieldConfig
  },
  rawValue: unknown
) {
  if (!Array.isArray(rawValue)) {
    throw new Error(`${field.label} requires one or more selections.`)
  }

  const normalizedValues = Array.from(
    new Set(
      rawValue
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )

  const allowedValues = new Set(
    field.config.options.map((option) => option.value)
  )

  if (field.config.allowOther) {
    allowedValues.add(otherCheckboxValue)
  }

  for (const value of normalizedValues) {
    if (!allowedValues.has(value)) {
      throw new Error(`${field.label} contains an invalid selection.`)
    }
  }

  if (field.required && normalizedValues.length === 0) {
    throw new Error(`${field.label} requires at least one selection.`)
  }

  if (
    typeof field.config.minSelections === "number" &&
    normalizedValues.length < field.config.minSelections
  ) {
    throw new Error(
      `${field.label} requires at least ${field.config.minSelections} selections.`
    )
  }

  if (
    typeof field.config.maxSelections === "number" &&
    normalizedValues.length > field.config.maxSelections
  ) {
    throw new Error(
      `${field.label} allows at most ${field.config.maxSelections} selections.`
    )
  }

  return normalizedValues
}

function parseTextValue(
  field: TrackableFormFieldSnapshot & {
    kind: "notes" | "short_text"
    config: NotesFieldConfig | ShortTextFieldConfig
  },
  rawValue: unknown
) {
  if (typeof rawValue !== "string") {
    throw new Error(`${field.label} requires text.`)
  }

  const normalizedValue = rawValue.trim()

  if (field.required && normalizedValue.length === 0) {
    throw new Error(`${field.label} cannot be empty.`)
  }

  if (
    typeof field.config.maxLength === "number" &&
    normalizedValue.length > field.config.maxLength
  ) {
    throw new Error(
      `${field.label} must be ${field.config.maxLength} characters or fewer.`
    )
  }

  return normalizedValue
}

export function getEmptyAnswerValue(
  field: AnswerableTrackableFormField
): FormAnswerValue {
  switch (field.kind) {
    case "rating":
      return { kind: "rating", value: 0 }
    case "checkboxes":
      return { kind: "checkboxes", value: [] }
    case "notes":
      return { kind: "notes", value: "" }
    case "short_text":
      return { kind: "short_text", value: "" }
  }
}

export function getOtherCheckboxValue() {
  return otherCheckboxValue
}
