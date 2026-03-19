import { relations, sql } from "drizzle-orm"
import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { apiKeys } from "@/db/schema/api-usage"
import {
  createdByUserId,
  revokedAt,
  timestamps,
  uuidPrimaryKey,
} from "@/db/schema/_shared"
import { workspaceRoleEnum } from "@/db/schema/enums"
import { trackableItems } from "@/db/schema/trackables"
import { users } from "@/db/schema/users"

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuidPrimaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
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
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").default("member").notNull(),
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

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  createdByUser: one(users, {
    fields: [workspaces.createdByUserId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  trackables: many(trackableItems),
  apiKeys: many(apiKeys),
}))

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
    createdByUser: one(users, {
      fields: [workspaceMembers.createdByUserId],
      references: [users.id],
    }),
  })
)
