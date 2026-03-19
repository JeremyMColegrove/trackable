CREATE TYPE "public"."trackable_kind" AS ENUM('survey', 'api_ingestion');--> statement-breakpoint
ALTER TABLE "trackable_items" ADD COLUMN "kind" "trackable_kind";--> statement-breakpoint
UPDATE "trackable_items"
SET "kind" = CASE
  WHEN COALESCE(("settings"->>'isFormEnabled')::boolean, true) = false
    AND COALESCE(("settings"->>'isApiEnabled')::boolean, true) = true
    THEN 'api_ingestion'::"trackable_kind"
  ELSE 'survey'::"trackable_kind"
END;--> statement-breakpoint
ALTER TABLE "trackable_items" ALTER COLUMN "kind" SET NOT NULL;
