import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { apiKeys } from "@/db/schema/api-usage"
import { workspaceSubscriptions } from "@/db/schema/subscriptions"
import { workspaceWebhooks } from "@/db/schema/webhooks"
import {
  createdByUserId,
  revokedAt,
  timestamps,
  uuidPrimaryKey,
} from "@/db/schema/_shared"
import {
  workspaceInvitationStatusEnum,
  workspaceRoleEnum,
} from "@/db/schema/enums"
import { trackableItems } from "@/db/schema/trackables"
import { users } from "@/db/schema/users"

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuidPrimaryKey(),
    name: text().notNull(),
    slug: text().notNull(),
    createdByUserId: createdByUserId().references(() => users.id, {
      onDelete: "cascade",
    }),
    ...timestamps,
  },
  (table) => [uniqueIndex("workspaces_slug_idx").on(table.slug)]
)

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuidPrimaryKey(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum().default("member").notNull(),
    createdByUserId: createdByUserId().references(() => users.id, {
      onDelete: "cascade",
    }),
    revokedAt: revokedAt(),
    ...timestamps,
  },
  (table) => [
    index("workspace_members_workspace_idx").on(table.workspaceId),
    index("workspace_members_user_idx").on(table.userId),
    uniqueIndex("workspace_members_workspace_user_idx")
      .on(table.workspaceId, table.userId)
      .where(sql`${table.revokedAt} is null`),
  ]
)

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuidPrimaryKey(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    invitedUserId: text().references(() => users.id, {
      onDelete: "cascade",
    }),
    invitedEmail: text(),
    invitedByUserId: createdByUserId().references(
      () => users.id,
      {
        onDelete: "cascade",
      }
    ),
    role: workspaceRoleEnum().default("member").notNull(),
    status: workspaceInvitationStatusEnum()
      .default("pending")
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("workspace_invitations_workspace_idx").on(table.workspaceId),
    index("workspace_invitations_invited_user_idx").on(table.invitedUserId),
    index("workspace_invitations_invited_email_idx").on(table.invitedEmail),
    uniqueIndex("workspace_invitations_pending_user_idx")
      .on(table.workspaceId, table.invitedUserId)
      .where(
        sql`${table.status} = 'pending' and ${table.invitedUserId} is not null`
      ),
    uniqueIndex("workspace_invitations_pending_email_idx")
      .on(table.workspaceId, table.invitedEmail)
      .where(
        sql`${table.status} = 'pending' and ${table.invitedEmail} is not null`
      ),
    check(
      "workspace_invitations_target_check",
      sql`${table.invitedUserId} is not null or ${table.invitedEmail} is not null`
    ),
  ]
)

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  createdByUser: one(users, {
    fields: [workspaces.createdByUserId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  invitations: many(workspaceInvitations),
  subscription: one(workspaceSubscriptions, {
    fields: [workspaces.id],
    references: [workspaceSubscriptions.workspaceId],
  }),
  trackables: many(trackableItems),
  apiKeys: many(apiKeys),
  webhooks: many(workspaceWebhooks),
}))

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      relationName: "workspaceMemberUser",
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
    createdByUser: one(users, {
      relationName: "workspaceMemberCreatedByUser",
      fields: [workspaceMembers.createdByUserId],
      references: [users.id],
    }),
  })
)

export const workspaceInvitationsRelations = relations(
  workspaceInvitations,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvitations.workspaceId],
      references: [workspaces.id],
    }),
    invitedUser: one(users, {
      relationName: "workspaceInvitationInvitedUser",
      fields: [workspaceInvitations.invitedUserId],
      references: [users.id],
    }),
    invitedByUser: one(users, {
      relationName: "workspaceInvitationInvitedByUser",
      fields: [workspaceInvitations.invitedByUserId],
      references: [users.id],
    }),
  })
)
