import { relations } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { lastSeenAt, timestamps } from "@/db/schema/_shared"
import {
  trackableAccessGrants,
  trackableFormSubmissions,
  trackableShareLinks,
} from "@/db/schema/trackables"
import {
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "@/db/schema/team"

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    primaryEmail: text("primary_email").notNull(),
    displayName: text("display_name"),
    imageUrl: text("image_url"),
    activeWorkspaceId: uuid("active_workspace_id").references(
      (): AnyPgColumn => workspaces.id,
      {
        onDelete: "set null",
      }
    ),
    hasAdminControls: boolean("has_admin_controls").default(false).notNull(),
    isProfilePrivate: boolean("is_profile_private").default(false).notNull(),
    lastSeenAt: lastSeenAt(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_primary_email_idx").on(table.primaryEmail)]
)

export const usersRelations = relations(users, ({ many, one }) => ({
  activeWorkspace: one(workspaces, {
    fields: [users.activeWorkspaceId],
    references: [workspaces.id],
  }),
  workspaceMemberships: many(workspaceMembers, {
    relationName: "workspaceMemberUser",
  }),
  createdWorkspaceMemberships: many(workspaceMembers, {
    relationName: "workspaceMemberCreatedByUser",
  }),
  receivedWorkspaceInvitations: many(workspaceInvitations, {
    relationName: "workspaceInvitationInvitedUser",
  }),
  sentWorkspaceInvitations: many(workspaceInvitations, {
    relationName: "workspaceInvitationInvitedByUser",
  }),
  createdWorkspaces: many(workspaces),
  createdShareLinks: many(trackableShareLinks),
  submittedFormResponses: many(trackableFormSubmissions),
  subjectAccessGrants: many(trackableAccessGrants, {
    relationName: "trackableAccessGrantSubjectUser",
  }),
  createdAccessGrants: many(trackableAccessGrants, {
    relationName: "trackableAccessGrantCreatedByUser",
  }),
}))
