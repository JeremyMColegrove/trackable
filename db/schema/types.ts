export type TrackableKind = "survey" | "api_ingestion"

export interface RatingFieldConfig {
  kind: "rating"
  scale: number
  icon?: "star" | "thumb" | "heart"
  labels?: {
    low?: string
    high?: string
  }
}

export interface CheckboxOption {
  id: string
  label: string
  value: string
}

export interface CheckboxesFieldConfig {
  kind: "checkboxes"
  options: CheckboxOption[]
  allowOther?: boolean
  minSelections?: number
  maxSelections?: number
}

export interface NotesFieldConfig {
  kind: "notes"
  placeholder?: string
  maxLength?: number
}

export interface ShortTextFieldConfig {
  kind: "short_text"
  placeholder?: string
  maxLength?: number
}

export type FormFieldConfig =
  | RatingFieldConfig
  | CheckboxesFieldConfig
  | NotesFieldConfig
  | ShortTextFieldConfig

export type FormAnswerValue =
  | { kind: "rating"; value: number }
  | { kind: "checkboxes"; value: string[] }
  | { kind: "notes"; value: string }
  | { kind: "short_text"; value: string }

export interface TrackableFormFieldSnapshot {
  id: string
  key: string
  kind: FormFieldConfig["kind"]
  label: string
  description: string | null
  required: boolean
  position: number
  config: FormFieldConfig
}

export interface TrackableFormSnapshot {
  id: string
  version: number
  title: string
  description: string | null
  status: "draft" | "published" | "archived"
  submitLabel: string | null
  successMessage: string | null
  fields: TrackableFormFieldSnapshot[]
}

export interface TrackableFormAnswerSnapshot {
  fieldId: string
  fieldKey: string
  fieldKind: FormAnswerValue["kind"]
  fieldLabel: string
  value: FormAnswerValue
}

export interface TrackableSubmissionSnapshot {
  form: TrackableFormSnapshot
  answers: TrackableFormAnswerSnapshot[]
}

export interface TrackableSettings {
  allowAnonymousSubmissions?: boolean
  allowMultipleSubmissions?: boolean
  collectResponderEmail?: boolean
  successRedirectUrl?: string | null
  apiLogRetentionDays?: 3 | 7 | 30 | 90 | null
}

export interface SubmissionMetadata {
  ipHash?: string
  userAgent?: string
  referrer?: string
  locale?: string
  deviceId?: string
}

export type UsageEventMetadata = string

export type UsageEventPayload = Record<string, unknown>
