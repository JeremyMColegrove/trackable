ALTER TYPE "public"."webhook_trigger_type" ADD VALUE 'survey_response_received';--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ALTER COLUMN "usage_event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_submission_id_trackable_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."trackable_form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_submission_idx" ON "webhook_delivery_attempts" USING btree ("submission_id");