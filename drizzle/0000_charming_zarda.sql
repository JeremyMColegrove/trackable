CREATE TYPE "public"."api_key_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."batch_job_run_status" AS ENUM('running', 'success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."batch_job_trigger" AS ENUM('cron', 'manual');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'expired', 'paused', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."trackable_access_role" AS ENUM('submit', 'view', 'manage');--> statement-breakpoint
CREATE TYPE "public"."trackable_access_subject_type" AS ENUM('user', 'email');--> statement-breakpoint
CREATE TYPE "public"."trackable_asset_kind" AS ENUM('image', 'file');--> statement-breakpoint
CREATE TYPE "public"."trackable_form_field_kind" AS ENUM('rating', 'checkboxes', 'notes', 'short_text', 'file_upload', 'youtube_video');--> statement-breakpoint
CREATE TYPE "public"."trackable_form_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."trackable_kind" AS ENUM('survey', 'api_ingestion');--> statement-breakpoint
CREATE TYPE "public"."trackable_submission_source" AS ENUM('public_link', 'user_grant', 'email_grant');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('generic', 'discord');--> statement-breakpoint
CREATE TYPE "public"."webhook_trigger_type" AS ENUM('log_match', 'log_count_match', 'survey_response_received');--> statement-breakpoint
CREATE TYPE "public"."workspace_invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"projectId" uuid,
	"name" text NOT NULL,
	"keyPrefix" text NOT NULL,
	"secretHash" text NOT NULL,
	"lastFour" text NOT NULL,
	"status" "api_key_status" DEFAULT 'active' NOT NULL,
	"expiresAt" timestamp with time zone,
	"lastUsedAt" timestamp with time zone,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_api_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackableId" uuid NOT NULL,
	"apiKeyId" uuid NOT NULL,
	"requestId" text,
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"publicKey" text NOT NULL,
	"privateKey" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"clientId" text NOT NULL,
	"sessionId" text,
	"refreshId" text,
	"userId" text,
	"referenceId" text,
	"scopes" text[] NOT NULL,
	"expiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "oauth_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"clientSecret" text,
	"disabled" boolean DEFAULT false,
	"skipConsent" boolean,
	"enableEndSession" boolean,
	"subjectType" text,
	"scopes" text[],
	"userId" text,
	"referenceId" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"softwareId" text,
	"softwareVersion" text,
	"softwareStatement" text,
	"redirectUris" text[] NOT NULL,
	"postLogoutRedirectUris" text[],
	"tokenEndpointAuthMethod" text,
	"grantTypes" text[],
	"responseTypes" text[],
	"public" boolean,
	"type" text,
	"requirePKCE" boolean,
	"metadata" text,
	CONSTRAINT "oauth_clients_clientId_unique" UNIQUE("clientId")
);
--> statement-breakpoint
CREATE TABLE "oauth_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"userId" text,
	"referenceId" text,
	"scopes" text[] NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"clientId" text NOT NULL,
	"sessionId" text,
	"userId" text,
	"referenceId" text,
	"scopes" text[] NOT NULL,
	"revoked" timestamp with time zone,
	"authTime" timestamp with time zone,
	"expiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "oauth_refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"lastLoginMethod" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "batch_job_leases" (
	"batchJobId" uuid PRIMARY KEY NOT NULL,
	"jobKey" text NOT NULL,
	"lockedUntil" timestamp with time zone NOT NULL,
	"lockedBy" text NOT NULL,
	"runId" uuid,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batchJobId" uuid NOT NULL,
	"jobKey" text NOT NULL,
	"trigger" "batch_job_trigger" NOT NULL,
	"status" "batch_job_run_status" NOT NULL,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone,
	"durationMs" integer,
	"summary" text,
	"errorDetails" jsonb,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"schedule" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"lastStartedAt" timestamp with time zone,
	"lastCompletedAt" timestamp with time zone,
	"lastStatus" "batch_job_run_status",
	"lastSummary" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdByUserId" text NOT NULL,
	"name" text NOT NULL,
	"keyPrefix" text NOT NULL,
	"secretHash" text NOT NULL,
	"lastFour" text NOT NULL,
	"capabilities" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expiresAt" timestamp with time zone,
	"lastUsedAt" timestamp with time zone,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"lemonSqueezySubscriptionId" text,
	"lemonSqueezyCustomerId" text,
	"variantId" text,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"currentPeriodEnd" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"invitedUserId" text,
	"invitedEmail" text,
	"invitedByUserId" text NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"status" "workspace_invitation_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_target_check" CHECK ("workspace_invitations"."invitedUserId" is not null or "workspace_invitations"."invitedEmail" is not null)
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"userId" text NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"createdByUserId" text NOT NULL,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"createdByUserId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackableId" uuid NOT NULL,
	"subjectType" "trackable_access_subject_type" NOT NULL,
	"subjectUserId" text,
	"subjectEmail" text,
	"role" "trackable_access_role" DEFAULT 'submit' NOT NULL,
	"createdByUserId" text NOT NULL,
	"acceptedAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trackable_access_grants_subject_check" CHECK ((
        "trackable_access_grants"."subjectType" = 'user'
        and "trackable_access_grants"."subjectUserId" is not null
        and "trackable_access_grants"."subjectEmail" is null
      ) or (
        "trackable_access_grants"."subjectType" = 'email'
        and "trackable_access_grants"."subjectUserId" is null
        and "trackable_access_grants"."subjectEmail" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "trackable_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackableId" uuid NOT NULL,
	"uploadedByUserId" text NOT NULL,
	"publicToken" text NOT NULL,
	"kind" "trackable_asset_kind" NOT NULL,
	"originalFileName" text NOT NULL,
	"mimeType" text NOT NULL,
	"extension" text NOT NULL,
	"originalBytes" integer NOT NULL,
	"storedBytes" integer NOT NULL,
	"storageKey" text NOT NULL,
	"imageWidth" integer,
	"imageHeight" integer,
	"imageFormat" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_form_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submissionId" uuid NOT NULL,
	"fieldId" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formId" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" "trackable_form_field_kind" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"config" jsonb NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackableId" uuid NOT NULL,
	"formId" uuid NOT NULL,
	"shareLinkId" uuid,
	"submittedByUserId" text,
	"submittedEmail" text,
	"source" "trackable_submission_source" NOT NULL,
	"submissionSnapshot" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackableId" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "trackable_form_status" DEFAULT 'draft' NOT NULL,
	"submitLabel" text,
	"successMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"kind" "trackable_kind" NOT NULL,
	"activeFormId" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submissionCount" integer DEFAULT 0 NOT NULL,
	"apiUsageCount" integer DEFAULT 0 NOT NULL,
	"lastSubmissionAt" timestamp with time zone,
	"lastApiUsageAt" timestamp with time zone,
	"archivedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackableId" uuid NOT NULL,
	"token" text NOT NULL,
	"role" "trackable_access_role" DEFAULT 'submit' NOT NULL,
	"expiresAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdByUserId" text NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"primaryEmail" text NOT NULL,
	"displayName" text,
	"imageUrl" text,
	"activeWorkspaceId" uuid,
	"isProfilePrivate" boolean DEFAULT false NOT NULL,
	"lastSeenAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackable_webhook_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackableId" uuid NOT NULL,
	"webhookId" uuid NOT NULL,
	"createdByUserId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhookId" uuid NOT NULL,
	"triggerRuleId" uuid NOT NULL,
	"trackableId" uuid NOT NULL,
	"usageEventId" uuid,
	"submissionId" uuid,
	"provider" "webhook_provider" NOT NULL,
	"status" "webhook_delivery_status" NOT NULL,
	"requestPayload" jsonb NOT NULL,
	"responsePayload" jsonb,
	"errorMessage" text,
	"attemptedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_webhook_trigger_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhookId" uuid NOT NULL,
	"type" "webhook_trigger_type" NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdByUserId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_projectId_trackable_items_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_api_usage_events" ADD CONSTRAINT "trackable_api_usage_events_trackableId_trackable_items_id_fk" FOREIGN KEY ("trackableId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_api_usage_events" ADD CONSTRAINT "trackable_api_usage_events_apiKeyId_api_keys_id_fk" FOREIGN KEY ("apiKeyId") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_auth_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_clientId_oauth_clients_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."oauth_clients"("clientId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_sessionId_auth_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."auth_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_refreshId_oauth_refresh_tokens_id_fk" FOREIGN KEY ("refreshId") REFERENCES "public"."oauth_refresh_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_userId_auth_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_userId_auth_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_clientId_oauth_clients_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."oauth_clients"("clientId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_userId_auth_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_clientId_oauth_clients_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."oauth_clients"("clientId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_sessionId_auth_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."auth_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_userId_auth_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_auth_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_job_leases" ADD CONSTRAINT "batch_job_leases_batchJobId_batch_jobs_id_fk" FOREIGN KEY ("batchJobId") REFERENCES "public"."batch_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_job_runs" ADD CONSTRAINT "batch_job_runs_batchJobId_batch_jobs_id_fk" FOREIGN KEY ("batchJobId") REFERENCES "public"."batch_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invitedUserId_users_id_fk" FOREIGN KEY ("invitedUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invitedByUserId_users_id_fk" FOREIGN KEY ("invitedByUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_access_grants" ADD CONSTRAINT "trackable_access_grants_trackableId_trackable_items_id_fk" FOREIGN KEY ("trackableId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_access_grants" ADD CONSTRAINT "trackable_access_grants_subjectUserId_users_id_fk" FOREIGN KEY ("subjectUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_access_grants" ADD CONSTRAINT "trackable_access_grants_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_assets" ADD CONSTRAINT "trackable_assets_trackableId_trackable_items_id_fk" FOREIGN KEY ("trackableId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_assets" ADD CONSTRAINT "trackable_assets_uploadedByUserId_users_id_fk" FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_form_answers" ADD CONSTRAINT "trackable_form_answers_submissionId_trackable_form_submissions_id_fk" FOREIGN KEY ("submissionId") REFERENCES "public"."trackable_form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_form_answers" ADD CONSTRAINT "trackable_form_answers_fieldId_trackable_form_fields_id_fk" FOREIGN KEY ("fieldId") REFERENCES "public"."trackable_form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_form_fields" ADD CONSTRAINT "trackable_form_fields_formId_trackable_forms_id_fk" FOREIGN KEY ("formId") REFERENCES "public"."trackable_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_form_submissions" ADD CONSTRAINT "trackable_form_submissions_trackableId_trackable_items_id_fk" FOREIGN KEY ("trackableId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_form_submissions" ADD CONSTRAINT "trackable_form_submissions_formId_trackable_forms_id_fk" FOREIGN KEY ("formId") REFERENCES "public"."trackable_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_form_submissions" ADD CONSTRAINT "trackable_form_submissions_shareLinkId_trackable_share_links_id_fk" FOREIGN KEY ("shareLinkId") REFERENCES "public"."trackable_share_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_form_submissions" ADD CONSTRAINT "trackable_form_submissions_submittedByUserId_users_id_fk" FOREIGN KEY ("submittedByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_forms" ADD CONSTRAINT "trackable_forms_trackableId_trackable_items_id_fk" FOREIGN KEY ("trackableId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_items" ADD CONSTRAINT "trackable_items_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_items" ADD CONSTRAINT "trackable_items_activeFormId_trackable_forms_id_fk" FOREIGN KEY ("activeFormId") REFERENCES "public"."trackable_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_share_links" ADD CONSTRAINT "trackable_share_links_trackableId_trackable_items_id_fk" FOREIGN KEY ("trackableId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_share_links" ADD CONSTRAINT "trackable_share_links_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_activeWorkspaceId_workspaces_id_fk" FOREIGN KEY ("activeWorkspaceId") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_webhook_connections" ADD CONSTRAINT "trackable_webhook_connections_trackableId_trackable_items_id_fk" FOREIGN KEY ("trackableId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_webhook_connections" ADD CONSTRAINT "trackable_webhook_connections_webhookId_workspace_webhooks_id_fk" FOREIGN KEY ("webhookId") REFERENCES "public"."workspace_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_webhook_connections" ADD CONSTRAINT "trackable_webhook_connections_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_webhookId_workspace_webhooks_id_fk" FOREIGN KEY ("webhookId") REFERENCES "public"."workspace_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_triggerRuleId_workspace_webhook_trigger_rules_id_fk" FOREIGN KEY ("triggerRuleId") REFERENCES "public"."workspace_webhook_trigger_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_trackableId_trackable_items_id_fk" FOREIGN KEY ("trackableId") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_usageEventId_trackable_api_usage_events_id_fk" FOREIGN KEY ("usageEventId") REFERENCES "public"."trackable_api_usage_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_submissionId_trackable_form_submissions_id_fk" FOREIGN KEY ("submissionId") REFERENCES "public"."trackable_form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhook_trigger_rules" ADD CONSTRAINT "workspace_webhook_trigger_rules_webhookId_workspace_webhooks_id_fk" FOREIGN KEY ("webhookId") REFERENCES "public"."workspace_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhooks" ADD CONSTRAINT "workspace_webhooks_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhooks" ADD CONSTRAINT "workspace_webhooks_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_prefix_idx" ON "api_keys" USING btree ("keyPrefix");--> statement-breakpoint
CREATE INDEX "api_keys_workspace_idx" ON "api_keys" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "api_keys_project_idx" ON "api_keys" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "api_keys_status_idx" ON "api_keys" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_api_usage_events_request_id_idx" ON "trackable_api_usage_events" USING btree ("requestId");--> statement-breakpoint
CREATE INDEX "trackable_api_usage_events_trackable_occurred_idx" ON "trackable_api_usage_events" USING btree ("trackableId","occurredAt");--> statement-breakpoint
CREATE INDEX "trackable_api_usage_events_trackable_occurred_id_idx" ON "trackable_api_usage_events" USING btree ("trackableId","occurredAt","id");--> statement-breakpoint
CREATE INDEX "trackable_api_usage_events_api_key_occurred_idx" ON "trackable_api_usage_events" USING btree ("apiKeyId","occurredAt");--> statement-breakpoint
CREATE INDEX "trackable_api_usage_events_payload_gin_idx" ON "trackable_api_usage_events" USING gin ("payload");--> statement-breakpoint
CREATE INDEX "trackable_api_usage_events_metadata_gin_idx" ON "trackable_api_usage_events" USING gin ("metadata") WHERE "trackable_api_usage_events"."metadata" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "batch_job_leases_job_key_idx" ON "batch_job_leases" USING btree ("jobKey");--> statement-breakpoint
CREATE INDEX "batch_job_leases_locked_until_idx" ON "batch_job_leases" USING btree ("lockedUntil");--> statement-breakpoint
CREATE INDEX "batch_job_runs_job_key_idx" ON "batch_job_runs" USING btree ("jobKey");--> statement-breakpoint
CREATE INDEX "batch_job_runs_batch_job_idx" ON "batch_job_runs" USING btree ("batchJobId");--> statement-breakpoint
CREATE INDEX "batch_job_runs_started_at_idx" ON "batch_job_runs" USING btree ("startedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_jobs_key_idx" ON "batch_jobs" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_access_tokens_key_prefix_idx" ON "mcp_access_tokens" USING btree ("keyPrefix");--> statement-breakpoint
CREATE INDEX "mcp_access_tokens_status_idx" ON "mcp_access_tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mcp_access_tokens_created_by_idx" ON "mcp_access_tokens" USING btree ("createdByUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscriptions_workspace_idx" ON "workspace_subscriptions" USING btree ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscriptions_ls_sub_idx" ON "workspace_subscriptions" USING btree ("lemonSqueezySubscriptionId") WHERE "workspace_subscriptions"."lemonSqueezySubscriptionId" is not null;--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_idx" ON "workspace_invitations" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "workspace_invitations_invited_user_idx" ON "workspace_invitations" USING btree ("invitedUserId");--> statement-breakpoint
CREATE INDEX "workspace_invitations_invited_email_idx" ON "workspace_invitations" USING btree ("invitedEmail");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_pending_user_idx" ON "workspace_invitations" USING btree ("workspaceId","invitedUserId") WHERE "workspace_invitations"."status" = 'pending' and "workspace_invitations"."invitedUserId" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_pending_email_idx" ON "workspace_invitations" USING btree ("workspaceId","invitedEmail") WHERE "workspace_invitations"."status" = 'pending' and "workspace_invitations"."invitedEmail" is not null;--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_idx" ON "workspace_members" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_user_idx" ON "workspace_members" USING btree ("workspaceId","userId") WHERE "workspace_members"."revokedAt" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "trackable_access_grants_trackable_idx" ON "trackable_access_grants" USING btree ("trackableId");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_access_grants_trackable_user_idx" ON "trackable_access_grants" USING btree ("trackableId","subjectUserId") WHERE "trackable_access_grants"."subjectUserId" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_access_grants_trackable_email_idx" ON "trackable_access_grants" USING btree ("trackableId","subjectEmail") WHERE "trackable_access_grants"."subjectEmail" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_assets_public_token_idx" ON "trackable_assets" USING btree ("publicToken");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_assets_storage_key_idx" ON "trackable_assets" USING btree ("storageKey");--> statement-breakpoint
CREATE INDEX "trackable_assets_trackable_idx" ON "trackable_assets" USING btree ("trackableId");--> statement-breakpoint
CREATE INDEX "trackable_assets_uploaded_by_idx" ON "trackable_assets" USING btree ("uploadedByUserId");--> statement-breakpoint
CREATE INDEX "trackable_assets_created_at_idx" ON "trackable_assets" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_form_answers_submission_field_idx" ON "trackable_form_answers" USING btree ("submissionId","fieldId");--> statement-breakpoint
CREATE INDEX "trackable_form_answers_submission_idx" ON "trackable_form_answers" USING btree ("submissionId");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_form_fields_form_key_idx" ON "trackable_form_fields" USING btree ("formId","key");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_form_fields_form_position_idx" ON "trackable_form_fields" USING btree ("formId","position");--> statement-breakpoint
CREATE INDEX "trackable_form_fields_form_idx" ON "trackable_form_fields" USING btree ("formId");--> statement-breakpoint
CREATE INDEX "trackable_form_submissions_trackable_idx" ON "trackable_form_submissions" USING btree ("trackableId");--> statement-breakpoint
CREATE INDEX "trackable_form_submissions_form_idx" ON "trackable_form_submissions" USING btree ("formId");--> statement-breakpoint
CREATE INDEX "trackable_form_submissions_created_at_idx" ON "trackable_form_submissions" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_forms_trackable_version_idx" ON "trackable_forms" USING btree ("trackableId","version");--> statement-breakpoint
CREATE INDEX "trackable_forms_trackable_idx" ON "trackable_forms" USING btree ("trackableId");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_items_workspace_slug_idx" ON "trackable_items" USING btree ("workspaceId","slug");--> statement-breakpoint
CREATE INDEX "trackable_items_workspace_idx" ON "trackable_items" USING btree ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_share_links_token_idx" ON "trackable_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "trackable_share_links_trackable_idx" ON "trackable_share_links" USING btree ("trackableId");--> statement-breakpoint
CREATE UNIQUE INDEX "users_primary_email_idx" ON "users" USING btree ("primaryEmail");--> statement-breakpoint
CREATE INDEX "trackable_webhook_connections_trackable_idx" ON "trackable_webhook_connections" USING btree ("trackableId");--> statement-breakpoint
CREATE INDEX "trackable_webhook_connections_webhook_idx" ON "trackable_webhook_connections" USING btree ("webhookId");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_webhook_connections_trackable_webhook_idx" ON "trackable_webhook_connections" USING btree ("trackableId","webhookId");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_webhook_attempted_idx" ON "webhook_delivery_attempts" USING btree ("webhookId","attemptedAt");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_trackable_attempted_idx" ON "webhook_delivery_attempts" USING btree ("trackableId","attemptedAt");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_usage_event_idx" ON "webhook_delivery_attempts" USING btree ("usageEventId");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_submission_idx" ON "webhook_delivery_attempts" USING btree ("submissionId");--> statement-breakpoint
CREATE INDEX "workspace_webhook_trigger_rules_webhook_idx" ON "workspace_webhook_trigger_rules" USING btree ("webhookId");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_webhook_trigger_rules_webhook_position_idx" ON "workspace_webhook_trigger_rules" USING btree ("webhookId","position");--> statement-breakpoint
CREATE INDEX "workspace_webhooks_workspace_idx" ON "workspace_webhooks" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "workspace_webhooks_provider_idx" ON "workspace_webhooks" USING btree ("provider");