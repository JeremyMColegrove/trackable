export type TrackableKind = "survey" | "api_ingestion"
export type TrackableAssetKind = "image" | "file"

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

export interface YouTubeVideoFieldConfig {
  kind: "youtube_video"
  url: string
}

export type FormFieldConfig =
  | RatingFieldConfig
  | CheckboxesFieldConfig
  | NotesFieldConfig
  | ShortTextFieldConfig
  | YouTubeVideoFieldConfig

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

export interface TrackableAssetRecord {
  id: string
  trackableId: string
  publicToken: string
  kind: TrackableAssetKind
  originalFileName: string
  mimeType: string
  extension: string
  originalBytes: number
  storedBytes: number
  storageKey: string
  imageWidth: number | null
  imageHeight: number | null
  imageFormat: string | null
  createdAt: string
  updatedAt: string
  url: string
}

export type UsageEventMetadata = Record<string, unknown>

export type UsageEventPayload = Record<string, unknown>

export type WebhookProvider = "discord" | "generic"
export type WebhookTriggerType =
  | "log_count_match"
  | "log_match"
  | "survey_response_received"

export interface GenericWebhookConfig {
  provider: "generic"
  url: string
  secret?: string | null
  headers?: Record<string, string>
}

export interface DiscordWebhookConfig {
  provider: "discord"
  url: string
  username?: string | null
  avatarUrl?: string | null
}

export type WebhookProviderConfig = DiscordWebhookConfig | GenericWebhookConfig

export interface LogMatchTriggerConfig {
  type: "log_match"
  liqeQuery: string
}

export interface LogCountMatchTriggerConfig {
  type: "log_count_match"
  liqeQuery: string
  windowMinutes: number
  matchCount: number
}

export interface SurveyResponseReceivedTriggerConfig {
  type: "survey_response_received"
}

export type WebhookTriggerConfig =
  | LogCountMatchTriggerConfig
  | LogMatchTriggerConfig
  | SurveyResponseReceivedTriggerConfig

export interface WebhookDeliveryRequestPayload {
  url: string
  method: "POST"
  headers: Record<string, string>
  body: string
}

export interface WebhookDeliveryResponsePayload {
  status: number
  body: string | null
}
