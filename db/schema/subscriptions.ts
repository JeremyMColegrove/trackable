import { relations, sql } from "drizzle-orm"
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import {
  nullableTimestamp,
  timestamps,
  uuidPrimaryKey,
} from "@/db/schema/_shared"
import { subscriptionStatusEnum } from "@/db/schema/enums"
import { workspaces } from "@/db/schema/team"

export const workspaceSubscriptions = pgTable(
  "workspace_subscriptions",
  {
    id: uuidPrimaryKey(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    lemonSqueezySubscriptionId: text(),
    lemonSqueezyCustomerId: text(),
    variantId: text(),
    tier: text().default("free").notNull(),
    status: subscriptionStatusEnum().default("active").notNull(),
    currentPeriodEnd: nullableTimestamp(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_subscriptions_workspace_idx").on(table.workspaceId),
    uniqueIndex("workspace_subscriptions_ls_sub_idx")
      .on(table.lemonSqueezySubscriptionId)
      .where(sql`${table.lemonSqueezySubscriptionId} is not null`),
  ]
)

export const workspaceSubscriptionsRelations = relations(
  workspaceSubscriptions,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceSubscriptions.workspaceId],
      references: [workspaces.id],
    }),
  })
)
