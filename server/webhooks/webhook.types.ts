import type {
  SubmissionMetadata,
  TrackableSubmissionSnapshot,
  WebhookDeliveryRequestPayload,
  WebhookDeliveryResponsePayload,
  WebhookProvider,
  WebhookProviderConfig,
  WebhookTriggerConfig,
} from "@/db/schema/types"

export interface WebhookUsageEvent {
  kind: "usage_event"
  id: string
  trackableId: string
  workspaceId: string
  occurredAt: Date
  payload: Record<string, unknown>
  metadata: Record<string, unknown> | null
}

export interface WebhookSurveyResponseEvent {
  kind: "survey_response"
  id: string
  trackableId: string
  workspaceId: string
  occurredAt: Date
  payload: {
    source: "public_link" | "user_grant" | "email_grant"
    submitterLabel: string
    submissionSnapshot: TrackableSubmissionSnapshot
  }
  metadata: SubmissionMetadata | null
}

export type WebhookEvent = WebhookUsageEvent | WebhookSurveyResponseEvent

export interface WebhookTriggerRuleRecord {
  id: string
  webhookId: string
  enabled: boolean
  position: number
  config: WebhookTriggerConfig
}

export interface WorkspaceWebhookRecord {
  id: string
  workspaceId: string
  name: string
  provider: WebhookProvider
  config: WebhookProviderConfig
  enabled: boolean
  triggerRules: WebhookTriggerRuleRecord[]
}

export interface AttachedWebhookRecord extends WorkspaceWebhookRecord {
  trackableId: string
}

export interface WebhookTriggerMatch {
  ruleId: string
  reason: string
}

export interface WebhookDeliveryContext {
  webhook: WorkspaceWebhookRecord
  triggerRule: WebhookTriggerRuleRecord
  event: WebhookEvent
  match: WebhookTriggerMatch
}

export interface WebhookDeliveryRequest {
  request: WebhookDeliveryRequestPayload
}

export interface WebhookExecutionResult {
  ok: boolean
  response: WebhookDeliveryResponsePayload | null
  errorMessage: string | null
  statusCode: number | null
  failureKind: "transport_error" | "downstream_error" | null
}

export interface WebhookHttpClient {
  send(
    request: WebhookDeliveryRequestPayload
  ): Promise<WebhookDeliveryResponsePayload>
}

export interface WebhookProviderContract {
  readonly provider: WebhookProvider
  buildRequest(context: WebhookDeliveryContext): WebhookDeliveryRequest
}

export interface WebhookEventRepositoryContract {
  countMatchingEvents(input: {
    filterQuery: string
    trackableId: string
    occurredAfter?: Date | null
    occurredBefore?: Date | null
  }): Promise<number>
}

export interface WebhookQueueEventSnapshot {
  kind: WebhookEvent["kind"]
  id: string
  occurredAt: string
  trackableId: string
  workspaceId: string
}

export interface WebhookQueueJobData {
  event: WebhookQueueEventSnapshot
  webhook: WorkspaceWebhookRecord
  triggerRule: WebhookTriggerRuleRecord
}

export interface WebhookQueueContract {
  enqueue(jobs: WebhookQueueJobData[]): Promise<void>
}
