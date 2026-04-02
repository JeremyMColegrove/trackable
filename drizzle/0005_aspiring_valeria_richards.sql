CREATE TYPE "public"."trackable_asset_kind" AS ENUM('image', 'file');--> statement-breakpoint
ALTER TYPE "public"."trackable_form_field_kind" ADD VALUE 'youtube_video';--> statement-breakpoint
CREATE TABLE "trackable_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trackable_id" uuid NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"public_token" text NOT NULL,
	"kind" "trackable_asset_kind" NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"extension" text NOT NULL,
	"original_bytes" integer NOT NULL,
	"stored_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"image_width" integer,
	"image_height" integer,
	"image_format" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trackable_assets" ADD CONSTRAINT "trackable_assets_trackable_id_trackable_items_id_fk" FOREIGN KEY ("trackable_id") REFERENCES "public"."trackable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackable_assets" ADD CONSTRAINT "trackable_assets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_assets_public_token_idx" ON "trackable_assets" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "trackable_assets_storage_key_idx" ON "trackable_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "trackable_assets_trackable_idx" ON "trackable_assets" USING btree ("trackable_id");--> statement-breakpoint
CREATE INDEX "trackable_assets_uploaded_by_idx" ON "trackable_assets" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "trackable_assets_created_at_idx" ON "trackable_assets" USING btree ("created_at");