CREATE TYPE "public"."api_key_status" AS ENUM('active', 'revoked');
CREATE TYPE "public"."batch_job_run_status" AS ENUM('running', 'success', 'failed', 'skipped');
CREATE TYPE "public"."batch_job_trigger" AS ENUM('cron', 'manual');
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'expired', 'paused', 'past_due');
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'plus', 'pro');
CREATE TYPE "public"."trackable_access_role" AS ENUM('submit', 'view', 'manage');
CREATE TYPE "public"."trackable_access_subject_type" AS ENUM('user', 'email');
CREATE TYPE "public"."trackable_form_field_kind" AS ENUM('rating', 'checkboxes', 'notes', 'short_text');
CREATE TYPE "public"."trackable_form_status" AS ENUM('draft', 'published', 'archived');
CREATE TYPE "public"."trackable_kind" AS ENUM('survey', 'api_ingestion');
CREATE TYPE "public"."trackable_submission_source" AS ENUM('public_link', 'user_grant', 'email_grant');
CREATE TYPE "public"."workspace_invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'revoked');
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member', 'viewer');
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"secret_hash" text NOT NULL,
	"last_four" text NOT NULL,
	"status" "api_key_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trackable_api_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackable_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"request_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" text
);

CREATE TABLE "batch_job_leases" (
	"batch_job_id" uuid PRIMARY KEY NOT NULL,
	"job_key" text NOT NULL,
	"locked_until" timestamp with time zone NOT NULL,
	"locked_by" text NOT NULL,
	"run_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "batch_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_job_id" uuid NOT NULL,
	"job_key" text NOT NULL,
	"trigger" "batch_job_trigger" NOT NULL,
	"status" "batch_job_run_status" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"summary" text,
	"error_details" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "batch_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"schedule" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_completed_at" timestamp with time zone,
	"last_status" "batch_job_run_status",
	"last_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspace_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lemon_squeezy_subscription_id" text NOT NULL,
	"lemon_squeezy_customer_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invited_user_id" text,
	"invited_email" text,
	"invited_by_user_id" text NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"status" "workspace_invitation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_target_check" CHECK (("workspace_invitations"."invited_user_id" is not null or "workspace_invitations"."invited_email" is not null))
);

CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trackable_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackable_id" uuid NOT NULL,
	"subject_type" "trackable_access_subject_type" NOT NULL,
	"subject_user_id" text,
	"subject_email" text,
	"role" "trackable_access_role" DEFAULT 'submit' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trackable_access_grants_subject_check" CHECK ((
        "trackable_access_grants"."subject_type" = 'user'
        and "trackable_access_grants"."subject_user_id" is not null
        and "trackable_access_grants"."subject_email" is null
      ) or (
        "trackable_access_grants"."subject_type" = 'email'
        and "trackable_access_grants"."subject_user_id" is null
        and "trackable_access_grants"."subject_email" is not null
      ))
);

CREATE TABLE "trackable_form_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trackable_form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" "trackable_form_field_kind" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"config" jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trackable_form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackable_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"share_link_id" uuid,
	"submitted_by_user_id" text,
	"submitted_email" text,
	"source" "trackable_submission_source" NOT NULL,
	"submission_snapshot" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trackable_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackable_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "trackable_form_status" DEFAULT 'draft' NOT NULL,
	"submit_label" text,
	"success_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trackable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"kind" "trackable_kind" NOT NULL,
	"active_form_id" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"api_usage_count" integer DEFAULT 0 NOT NULL,
	"last_submission_at" timestamp with time zone,
	"last_api_usage_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trackable_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackable_id" uuid NOT NULL,
	"token" text NOT NULL,
	"role" "trackable_access_role" DEFAULT 'submit' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"primary_email" text NOT NULL,
	"display_name" text,
	"image_url" text,
	"active_workspace_id" uuid,
	"has_admin_controls" boolean DEFAULT false NOT NULL,
	"is_profile_private" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_trackable_items_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_api_usage_events" ADD CONSTRAINT "trackable_api_usage_events_trackable_id_trackable_items_id_fk" FOREIGN KEY ("trackable_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_api_usage_events" ADD CONSTRAINT "trackable_api_usage_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "batch_job_leases" ADD CONSTRAINT "batch_job_leases_batch_job_id_batch_jobs_id_fk" FOREIGN KEY ("batch_job_id") REFERENCES "public"."batch_jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "batch_job_runs" ADD CONSTRAINT "batch_job_runs_batch_job_id_batch_jobs_id_fk" FOREIGN KEY ("batch_job_id") REFERENCES "public"."batch_jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_access_grants" ADD CONSTRAINT "trackable_access_grants_trackable_id_trackable_items_id_fk" FOREIGN KEY ("trackable_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_access_grants" ADD CONSTRAINT "trackable_access_grants_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_access_grants" ADD CONSTRAINT "trackable_access_grants_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_form_answers" ADD CONSTRAINT "trackable_form_answers_submission_id_trackable_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."trackable_form_submissions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_form_answers" ADD CONSTRAINT "trackable_form_answers_field_id_trackable_form_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."trackable_form_fields"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_form_fields" ADD CONSTRAINT "trackable_form_fields_form_id_trackable_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."trackable_forms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_form_submissions" ADD CONSTRAINT "trackable_form_submissions_trackable_id_trackable_items_id_fk" FOREIGN KEY ("trackable_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_form_submissions" ADD CONSTRAINT "trackable_form_submissions_form_id_trackable_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."trackable_forms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_form_submissions" ADD CONSTRAINT "trackable_form_submissions_share_link_id_trackable_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."trackable_share_links"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "trackable_form_submissions" ADD CONSTRAINT "trackable_form_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "trackable_forms" ADD CONSTRAINT "trackable_forms_trackable_id_trackable_items_id_fk" FOREIGN KEY ("trackable_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_items" ADD CONSTRAINT "trackable_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_items" ADD CONSTRAINT "trackable_items_active_form_id_trackable_forms_id_fk" FOREIGN KEY ("active_form_id") REFERENCES "public"."trackable_forms"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "trackable_share_links" ADD CONSTRAINT "trackable_share_links_trackable_id_trackable_items_id_fk" FOREIGN KEY ("trackable_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trackable_share_links" ADD CONSTRAINT "trackable_share_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_active_workspace_id_workspaces_id_fk" FOREIGN KEY ("active_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "api_keys_key_prefix_idx" ON "api_keys" USING btree ("key_prefix");
CREATE INDEX "api_keys_workspace_idx" ON "api_keys" USING btree ("workspace_id");
CREATE INDEX "api_keys_project_idx" ON "api_keys" USING btree ("project_id");
CREATE INDEX "api_keys_status_idx" ON "api_keys" USING btree ("status");
CREATE UNIQUE INDEX "trackable_api_usage_events_request_id_idx" ON "trackable_api_usage_events" USING btree ("request_id");
CREATE INDEX "trackable_api_usage_events_trackable_occurred_idx" ON "trackable_api_usage_events" USING btree ("trackable_id","occurred_at");
CREATE INDEX "trackable_api_usage_events_api_key_occurred_idx" ON "trackable_api_usage_events" USING btree ("api_key_id","occurred_at");
CREATE UNIQUE INDEX "batch_job_leases_job_key_idx" ON "batch_job_leases" USING btree ("job_key");
CREATE INDEX "batch_job_leases_locked_until_idx" ON "batch_job_leases" USING btree ("locked_until");
CREATE INDEX "batch_job_runs_job_key_idx" ON "batch_job_runs" USING btree ("job_key");
CREATE INDEX "batch_job_runs_batch_job_idx" ON "batch_job_runs" USING btree ("batch_job_id");
CREATE INDEX "batch_job_runs_started_at_idx" ON "batch_job_runs" USING btree ("started_at");
CREATE UNIQUE INDEX "batch_jobs_key_idx" ON "batch_jobs" USING btree ("key");
CREATE UNIQUE INDEX "workspace_subscriptions_workspace_idx" ON "workspace_subscriptions" USING btree ("workspace_id");
CREATE UNIQUE INDEX "workspace_subscriptions_ls_sub_idx" ON "workspace_subscriptions" USING btree ("lemon_squeezy_subscription_id");
CREATE INDEX "workspace_members_workspace_idx" ON "workspace_members" USING btree ("workspace_id");
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");
CREATE UNIQUE INDEX "workspace_members_workspace_user_idx" ON "workspace_members" USING btree ("workspace_id","user_id") WHERE "workspace_members"."revoked_at" is null;
CREATE INDEX "workspace_invitations_workspace_idx" ON "workspace_invitations" USING btree ("workspace_id");
CREATE INDEX "workspace_invitations_invited_user_idx" ON "workspace_invitations" USING btree ("invited_user_id");
CREATE INDEX "workspace_invitations_invited_email_idx" ON "workspace_invitations" USING btree ("invited_email");
CREATE UNIQUE INDEX "workspace_invitations_pending_user_idx" ON "workspace_invitations" USING btree ("workspace_id","invited_user_id") WHERE "workspace_invitations"."status" = 'pending' and "workspace_invitations"."invited_user_id" is not null;
CREATE UNIQUE INDEX "workspace_invitations_pending_email_idx" ON "workspace_invitations" USING btree ("workspace_id","invited_email") WHERE "workspace_invitations"."status" = 'pending' and "workspace_invitations"."invited_email" is not null;
CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" USING btree ("slug");
CREATE INDEX "trackable_access_grants_trackable_idx" ON "trackable_access_grants" USING btree ("trackable_id");
CREATE UNIQUE INDEX "trackable_access_grants_trackable_user_idx" ON "trackable_access_grants" USING btree ("trackable_id","subject_user_id") WHERE "trackable_access_grants"."subject_user_id" is not null;
CREATE UNIQUE INDEX "trackable_access_grants_trackable_email_idx" ON "trackable_access_grants" USING btree ("trackable_id","subject_email") WHERE "trackable_access_grants"."subject_email" is not null;
CREATE UNIQUE INDEX "trackable_form_answers_submission_field_idx" ON "trackable_form_answers" USING btree ("submission_id","field_id");
CREATE INDEX "trackable_form_answers_submission_idx" ON "trackable_form_answers" USING btree ("submission_id");
CREATE UNIQUE INDEX "trackable_form_fields_form_key_idx" ON "trackable_form_fields" USING btree ("form_id","key");
CREATE UNIQUE INDEX "trackable_form_fields_form_position_idx" ON "trackable_form_fields" USING btree ("form_id","position");
CREATE INDEX "trackable_form_fields_form_idx" ON "trackable_form_fields" USING btree ("form_id");
CREATE INDEX "trackable_form_submissions_trackable_idx" ON "trackable_form_submissions" USING btree ("trackable_id");
CREATE INDEX "trackable_form_submissions_form_idx" ON "trackable_form_submissions" USING btree ("form_id");
CREATE INDEX "trackable_form_submissions_created_at_idx" ON "trackable_form_submissions" USING btree ("created_at");
CREATE UNIQUE INDEX "trackable_forms_trackable_version_idx" ON "trackable_forms" USING btree ("trackable_id","version");
CREATE INDEX "trackable_forms_trackable_idx" ON "trackable_forms" USING btree ("trackable_id");
CREATE UNIQUE INDEX "trackable_items_workspace_slug_idx" ON "trackable_items" USING btree ("workspace_id","slug");
CREATE INDEX "trackable_items_workspace_idx" ON "trackable_items" USING btree ("workspace_id");
CREATE UNIQUE INDEX "trackable_share_links_token_idx" ON "trackable_share_links" USING btree ("token");
CREATE INDEX "trackable_share_links_trackable_idx" ON "trackable_share_links" USING btree ("trackable_id");
CREATE UNIQUE INDEX "users_primary_email_idx" ON "users" USING btree ("primary_email");
