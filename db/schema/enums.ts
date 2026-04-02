import { pgEnum } from "drizzle-orm/pg-core"

export const trackableKindEnum = pgEnum("trackable_kind", [
  "survey",
  "api_ingestion",
])

export const trackableAccessSubjectTypeEnum = pgEnum(
  "trackable_access_subject_type",
  ["user", "email"]
)

export const trackableAccessRoleEnum = pgEnum("trackable_access_role", [
  "submit",
  "view",
  "manage",
])

export const trackableFormStatusEnum = pgEnum("trackable_form_status", [
  "draft",
  "published",
  "archived",
])

export const trackableFormFieldKindEnum = pgEnum("trackable_form_field_kind", [
  "rating",
  "checkboxes",
  "notes",
  "short_text",
  "youtube_video",
])

export const trackableAssetKindEnum = pgEnum("trackable_asset_kind", [
  "image",
  "file",
])

export const trackableSubmissionSourceEnum = pgEnum(
  "trackable_submission_source",
  ["public_link", "user_grant", "email_grant"]
)

export const apiKeyStatusEnum = pgEnum("api_key_status", ["active", "revoked"])

export const webhookProviderEnum = pgEnum("webhook_provider", [
  "generic",
  "discord",
])

export const webhookTriggerTypeEnum = pgEnum("webhook_trigger_type", [
  "log_match",
  "log_count_match",
  "survey_response_received",
])

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "success",
  "failed",
])

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "viewer",
])

export const workspaceInvitationStatusEnum = pgEnum(
  "workspace_invitation_status",
  ["pending", "accepted", "rejected", "revoked"]
)

export const batchJobRunStatusEnum = pgEnum("batch_job_run_status", [
  "running",
  "success",
  "failed",
  "skipped",
])

export const batchJobTriggerEnum = pgEnum("batch_job_trigger", [
  "cron",
  "manual",
])

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "plus",
  "pro",
])

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "expired",
  "paused",
  "past_due",
])
