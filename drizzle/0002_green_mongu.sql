CREATE TYPE "public"."webhook_delivery_status" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('generic', 'discord');--> statement-breakpoint
CREATE TYPE "public"."webhook_trigger_type" AS ENUM('log_match', 'log_count_match');--> statement-breakpoint
CREATE TABLE "trackable_webhook_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackable_id" uuid NOT NULL,
	"webhook_id" uuid NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"trigger_rule_id" uuid NOT NULL,
	"trackable_id" uuid NOT NULL,
	"usage_event_id" uuid NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"status" "webhook_delivery_status" NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_payload" jsonb,
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_webhook_trigger_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"type" "webhook_trigger_type" NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trackable_webhook_connections" ADD CONSTRAINT "trackable_webhook_connections_trackable_id_trackable_items_id_fk" FOREIGN KEY ("trackable_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_webhook_connections" ADD CONSTRAINT "trackable_webhook_connections_webhook_id_workspace_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."workspace_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_webhook_connections" ADD CONSTRAINT "trackable_webhook_connections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_webhook_id_workspace_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."workspace_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_trigger_rule_id_workspace_webhook_trigger_rules_id_fk" FOREIGN KEY ("trigger_rule_id") REFERENCES "public"."workspace_webhook_trigger_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_trackable_id_trackable_items_id_fk" FOREIGN KEY ("trackable_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_usage_event_id_trackable_api_usage_events_id_fk" FOREIGN KEY ("usage_event_id") REFERENCES "public"."trackable_api_usage_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhook_trigger_rules" ADD CONSTRAINT "workspace_webhook_trigger_rules_webhook_id_workspace_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."workspace_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhooks" ADD CONSTRAINT "workspace_webhooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhooks" ADD CONSTRAINT "workspace_webhooks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trackable_webhook_connections_trackable_idx" ON "trackable_webhook_connections" USING btree ("trackable_id");--> statement-breakpoint
CREATE INDEX "trackable_webhook_connections_webhook_idx" ON "trackable_webhook_connections" USING btree ("webhook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_webhook_connections_trackable_webhook_idx" ON "trackable_webhook_connections" USING btree ("trackable_id","webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_webhook_attempted_idx" ON "webhook_delivery_attempts" USING btree ("webhook_id","attempted_at");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_trackable_attempted_idx" ON "webhook_delivery_attempts" USING btree ("trackable_id","attempted_at");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_usage_event_idx" ON "webhook_delivery_attempts" USING btree ("usage_event_id");--> statement-breakpoint
CREATE INDEX "workspace_webhook_trigger_rules_webhook_idx" ON "workspace_webhook_trigger_rules" USING btree ("webhook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_webhook_trigger_rules_webhook_position_idx" ON "workspace_webhook_trigger_rules" USING btree ("webhook_id","position");--> statement-breakpoint
CREATE INDEX "workspace_webhooks_workspace_idx" ON "workspace_webhooks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_webhooks_provider_idx" ON "workspace_webhooks" USING btree ("provider");