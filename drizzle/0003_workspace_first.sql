CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member');

CREATE TABLE "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_by_user_id" text NOT NULL,
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

ALTER TABLE "users" ADD COLUMN "active_workspace_id" uuid;
ALTER TABLE "trackable_items" ADD COLUMN "workspace_id" uuid;
ALTER TABLE "api_keys" ADD COLUMN "workspace_id" uuid;

ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_active_workspace_id_workspaces_id_fk" FOREIGN KEY ("active_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;

INSERT INTO "workspaces" ("name", "slug", "created_by_user_id")
SELECT
  COALESCE(NULLIF("display_name", ''), split_part("primary_email", '@', 1)) || '''s Workspace',
  regexp_replace(lower(COALESCE(NULLIF("display_name", ''), split_part("primary_email", '@', 1))), '[^a-z0-9]+', '-', 'g') || '-' || right(regexp_replace("id", '[^a-zA-Z0-9]+', '', 'g'), 6),
  "id"
FROM "users";

INSERT INTO "workspace_members" ("workspace_id", "user_id", "role", "created_by_user_id")
SELECT "w"."id", "w"."created_by_user_id", 'owner', "w"."created_by_user_id"
FROM "workspaces" "w";

UPDATE "users" "u"
SET "active_workspace_id" = "w"."id"
FROM "workspaces" "w"
WHERE "w"."created_by_user_id" = "u"."id";

UPDATE "trackable_items" "t"
SET "workspace_id" = "w"."id"
FROM "workspaces" "w"
WHERE "w"."created_by_user_id" = "t"."owner_id";

UPDATE "api_keys" "k"
SET "workspace_id" = COALESCE("t"."workspace_id", "w"."id")
FROM "trackable_items" "t"
LEFT JOIN "workspaces" "w" ON "w"."created_by_user_id" = "k"."owner_id"
WHERE "t"."id" = "k"."project_id" OR ("t"."id" IS NULL AND "w"."created_by_user_id" = "k"."owner_id");

INSERT INTO "workspace_members" ("workspace_id", "user_id", "role", "created_by_user_id", "revoked_at", "created_at", "updated_at")
SELECT "w"."id", "wtm"."member_user_id", 'member', "wtm"."created_by_user_id", "wtm"."revoked_at", "wtm"."created_at", "wtm"."updated_at"
FROM "workspace_team_members" "wtm"
JOIN "workspaces" "w" ON "w"."created_by_user_id" = "wtm"."owner_id"
ON CONFLICT DO NOTHING;

ALTER TABLE "trackable_items" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "workspace_id" SET NOT NULL;

ALTER TABLE "trackable_items" ADD CONSTRAINT "trackable_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

DROP INDEX IF EXISTS "trackable_items_owner_slug_idx";
DROP INDEX IF EXISTS "trackable_items_owner_idx";
DROP INDEX IF EXISTS "api_keys_owner_idx";

CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" USING btree ("slug");
CREATE INDEX "workspace_members_workspace_idx" ON "workspace_members" USING btree ("workspace_id");
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");
CREATE UNIQUE INDEX "workspace_members_workspace_user_idx" ON "workspace_members" USING btree ("workspace_id", "user_id") WHERE "workspace_members"."revoked_at" is null;
CREATE UNIQUE INDEX "trackable_items_workspace_slug_idx" ON "trackable_items" USING btree ("workspace_id", "slug");
CREATE INDEX "trackable_items_workspace_idx" ON "trackable_items" USING btree ("workspace_id");
CREATE INDEX "api_keys_workspace_idx" ON "api_keys" USING btree ("workspace_id");

ALTER TABLE "trackable_items" DROP CONSTRAINT IF EXISTS "trackable_items_owner_id_users_id_fk";
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_owner_id_users_id_fk";
ALTER TABLE "trackable_items" DROP COLUMN "owner_id";
ALTER TABLE "api_keys" DROP COLUMN "owner_id";
DROP TABLE "workspace_team_members";
