// Re-export all form field config schemas and types from the canonical source.
// The Zod schemas live in lib/form-schemas.ts; this file re-exports the
// inferred TypeScript types so existing import paths continue to work.
export type {
  CheckboxOption,
  RatingFieldConfig,
  CheckboxesFieldConfig,
  NotesFieldConfig,
  ShortTextFieldConfig,
  FileUploadFieldConfig,
  YouTubeVideoFieldConfig,
  FormFieldConfig,
  FormAnswerValue,
  TrackableFormFieldSnapshot,
  TrackableFormSnapshot,
  TrackableFormAnswerSnapshot,
  TrackableSubmissionSnapshot,
  // TrackableAssetReference is also defined here as a Zod-derived type;
  // we keep the interface below for use in TrackableAssetRecord.
} from "@/lib/form-schemas"

// Re-export webhook config/trigger types from the canonical schema source.
export type {
  DiscordWebhookConfig,
  GenericWebhookConfig,
  MicrosoftTeamsWebhookConfig,
  WebhookProviderConfig,
  LogMatchTriggerConfig,
  LogCountMatchTriggerConfig,
  SurveyResponseReceivedTriggerConfig,
  WebhookTriggerConfig,
} from "@/server/webhooks/webhook.schemas"

// ---------------------------------------------------------------------------
// Domain primitives that are not derived from Zod schemas
// ---------------------------------------------------------------------------

export type TrackableKind = "survey" | "api_ingestion"
export type TrackableAssetKind = "image" | "file"

export interface TrackableAssetReference {
  id: string
  publicToken: string
  kind: TrackableAssetKind
  originalFileName: string
  mimeType: string
  imageWidth: number | null
  imageHeight: number | null
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

export type WebhookProvider = "discord" | "generic" | "microsoft_teams"
export type WebhookTriggerType =
  | "log_count_match"
  | "log_match"
  | "survey_response_received"

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
