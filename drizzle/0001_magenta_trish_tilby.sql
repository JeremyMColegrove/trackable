ALTER TABLE "workspace_subscriptions" ALTER COLUMN "tier" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ALTER COLUMN "tier" SET DEFAULT 'free';--> statement-breakpoint
DROP TYPE "public"."subscription_tier";