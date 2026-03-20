CREATE TYPE "public"."batch_job_run_status" AS ENUM('running', 'success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."batch_job_trigger" AS ENUM('cron', 'manual');--> statement-breakpoint
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
);--> statement-breakpoint
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
);--> statement-breakpoint
CREATE TABLE "batch_job_leases" (
	"batch_job_id" uuid PRIMARY KEY NOT NULL,
	"job_key" text NOT NULL,
	"locked_until" timestamp with time zone NOT NULL,
	"locked_by" text NOT NULL,
	"run_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "batch_job_runs" ADD CONSTRAINT "batch_job_runs_batch_job_id_batch_jobs_id_fk" FOREIGN KEY ("batch_job_id") REFERENCES "public"."batch_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_job_leases" ADD CONSTRAINT "batch_job_leases_batch_job_id_batch_jobs_id_fk" FOREIGN KEY ("batch_job_id") REFERENCES "public"."batch_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "batch_jobs_key_idx" ON "batch_jobs" USING btree ("key");--> statement-breakpoint
CREATE INDEX "batch_job_runs_job_key_idx" ON "batch_job_runs" USING btree ("job_key");--> statement-breakpoint
CREATE INDEX "batch_job_runs_batch_job_idx" ON "batch_job_runs" USING btree ("batch_job_id");--> statement-breakpoint
CREATE INDEX "batch_job_runs_started_at_idx" ON "batch_job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_job_leases_job_key_idx" ON "batch_job_leases" USING btree ("job_key");--> statement-breakpoint
CREATE INDEX "batch_job_leases_locked_until_idx" ON "batch_job_leases" USING btree ("locked_until");
