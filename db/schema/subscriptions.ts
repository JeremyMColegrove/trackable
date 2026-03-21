import { relations } from "drizzle-orm"
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { nullableTimestamp, timestamps, uuidPrimaryKey } from "@/db/schema/_shared"
import {
  subscriptionStatusEnum,
  subscriptionTierEnum,
} from "@/db/schema/enums"
import { workspaces } from "@/db/schema/team"

export const workspaceSubscriptions = pgTable(
  "workspace_subscriptions",
  {
    id: uuidPrimaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    lemonSqueezySubscriptionId: text("lemon_squeezy_subscription_id").notNull(),
    lemonSqueezyCustomerId: text("lemon_squeezy_customer_id").notNull(),
    variantId: text("variant_id").notNull(),
    tier: subscriptionTierEnum("tier").default("free").notNull(),
    status: subscriptionStatusEnum("status").default("active").notNull(),
    currentPeriodEnd: nullableTimestamp("current_period_end"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_subscriptions_workspace_idx").on(table.workspaceId),
    uniqueIndex("workspace_subscriptions_ls_sub_idx").on(
      table.lemonSqueezySubscriptionId
    ),
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
