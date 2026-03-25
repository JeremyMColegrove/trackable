CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'plus', 'pro');
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'expired', 'paused', 'past_due');
CREATE TABLE "workspace_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "lemon_squeezy_subscription_id" text,
  "lemon_squeezy_customer_id" text,
  "variant_id" text,
  "tier" "subscription_tier" DEFAULT 'free' NOT NULL,
  "status" "subscription_status" DEFAULT 'active' NOT NULL,
  "current_period_end" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "workspace_subscriptions_workspace_idx" ON "workspace_subscriptions" USING btree ("workspace_id");
CREATE UNIQUE INDEX "workspace_subscriptions_ls_sub_idx" ON "workspace_subscriptions" USING btree ("lemon_squeezy_subscription_id") WHERE "workspace_subscriptions"."lemon_squeezy_subscription_id" is not null;
INSERT INTO "workspace_subscriptions" ("workspace_id", "tier", "status")
SELECT "w"."id", 'free', 'active'
FROM "workspaces" "w"
LEFT JOIN "workspace_subscriptions" "ws" ON "ws"."workspace_id" = "w"."id"
WHERE "ws"."id" IS NULL;
