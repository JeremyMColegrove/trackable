-- Returns the current user ID from a transaction-local setting injected by
-- withUserContext() in db/index.ts. Returns NULL when no context is set.
CREATE OR REPLACE FUNCTION app_current_user_id()
  RETURNS text LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$;--> statement-breakpoint

-- Returns all workspace IDs the current user is an active member of.
-- SECURITY DEFINER so this runs as the function owner (superuser), bypassing
-- RLS on workspace_members itself and preventing infinite policy recursion.
CREATE OR REPLACE FUNCTION app_user_workspace_ids()
  RETURNS SETOF uuid
  SECURITY DEFINER
  SET search_path = public
  LANGUAGE sql STABLE AS $$
    SELECT "workspace_id" FROM workspace_members
    WHERE "user_id" = current_setting('app.current_user_id', true)
      AND "revoked_at" IS NULL;
$$;--> statement-breakpoint

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE trackable_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE workspace_webhooks ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE mcp_access_tokens ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Strict policies: no user context set = 0 rows returned for trackables_app.
-- trackables_worker has BYPASSRLS; the migration admin is superuser — both
-- bypass RLS automatically without needing explicit policies.

CREATE POLICY workspace_access ON workspaces
  AS PERMISSIVE FOR ALL TO trackables_app
  USING (id = ANY(SELECT app_user_workspace_ids()));--> statement-breakpoint

CREATE POLICY workspace_member_access ON workspace_members
  AS PERMISSIVE FOR ALL TO trackables_app
  USING ("workspace_id" = ANY(SELECT app_user_workspace_ids()));--> statement-breakpoint

-- Allow workspace members to see invitations they manage, AND allow invited
-- users to see their own invitations even before joining the workspace.
CREATE POLICY workspace_invitation_access ON workspace_invitations
  AS PERMISSIVE FOR ALL TO trackables_app
  USING (
    "workspace_id" = ANY(SELECT app_user_workspace_ids())
    OR "invited_user_id" = app_current_user_id()
  );--> statement-breakpoint

CREATE POLICY trackable_access ON trackable_items
  AS PERMISSIVE FOR ALL TO trackables_app
  USING ("workspace_id" = ANY(SELECT app_user_workspace_ids()));--> statement-breakpoint

CREATE POLICY api_key_access ON api_keys
  AS PERMISSIVE FOR ALL TO trackables_app
  USING ("workspace_id" = ANY(SELECT app_user_workspace_ids()));--> statement-breakpoint

CREATE POLICY workspace_webhook_access ON workspace_webhooks
  AS PERMISSIVE FOR ALL TO trackables_app
  USING ("workspace_id" = ANY(SELECT app_user_workspace_ids()));--> statement-breakpoint

CREATE POLICY workspace_subscription_access ON workspace_subscriptions
  AS PERMISSIVE FOR ALL TO trackables_app
  USING ("workspace_id" = ANY(SELECT app_user_workspace_ids()));--> statement-breakpoint

CREATE POLICY mcp_token_access ON mcp_access_tokens
  AS PERMISSIVE FOR ALL TO trackables_app
  USING ("created_by_user_id" = app_current_user_id());
