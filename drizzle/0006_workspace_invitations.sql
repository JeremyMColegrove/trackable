ALTER TYPE "public"."workspace_role" ADD VALUE IF NOT EXISTS 'viewer';

CREATE TYPE "public"."workspace_invitation_status" AS ENUM(
  'pending',
  'accepted',
  'rejected',
  'revoked'
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
  CONSTRAINT "workspace_invitations_target_check"
    CHECK (
      "workspace_invitations"."invited_user_id" is not null
      or "workspace_invitations"."invited_email" is not null
    )
);

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id")
  REFERENCES "public"."workspaces"("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_invited_user_id_users_id_fk"
  FOREIGN KEY ("invited_user_id")
  REFERENCES "public"."users"("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_invited_by_user_id_users_id_fk"
  FOREIGN KEY ("invited_by_user_id")
  REFERENCES "public"."users"("id")
  ON DELETE cascade
  ON UPDATE no action;

CREATE INDEX "workspace_invitations_workspace_idx"
  ON "workspace_invitations" USING btree ("workspace_id");

CREATE INDEX "workspace_invitations_invited_user_idx"
  ON "workspace_invitations" USING btree ("invited_user_id");

CREATE INDEX "workspace_invitations_invited_email_idx"
  ON "workspace_invitations" USING btree ("invited_email");

CREATE UNIQUE INDEX "workspace_invitations_pending_user_idx"
  ON "workspace_invitations" USING btree ("workspace_id", "invited_user_id")
  WHERE "workspace_invitations"."status" = 'pending'
    AND "workspace_invitations"."invited_user_id" is not null;

CREATE UNIQUE INDEX "workspace_invitations_pending_email_idx"
  ON "workspace_invitations" USING btree ("workspace_id", "invited_email")
  WHERE "workspace_invitations"."status" = 'pending'
    AND "workspace_invitations"."invited_email" is not null;
