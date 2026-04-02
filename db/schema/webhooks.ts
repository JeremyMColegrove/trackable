import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import {
  occurredAt,
  timestamps,
  uuidPrimaryKey,
} from "@/db/schema/_shared"
import {
  webhookDeliveryStatusEnum,
  webhookProviderEnum,
  webhookTriggerTypeEnum,
} from "@/db/schema/enums"
import { workspaces } from "@/db/schema/team"
import { trackableApiUsageEvents } from "@/db/schema/api-usage"
import { trackableFormSubmissions, trackableItems } from "@/db/schema/trackables"
import type {
  WebhookDeliveryRequestPayload,
  WebhookDeliveryResponsePayload,
  WebhookProviderConfig,
  WebhookTriggerConfig,
} from "@/db/schema/types"
import { users } from "@/db/schema/users"

export const workspaceWebhooks = pgTable(
  "workspace_webhooks",
  {
    id: uuidPrimaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    provider: webhookProviderEnum("provider").notNull(),
    config: jsonb("config").$type<WebhookProviderConfig>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("workspace_webhooks_workspace_idx").on(table.workspaceId),
    index("workspace_webhooks_provider_idx").on(table.provider),
  ]
)

export const workspaceWebhookTriggerRules = pgTable(
  "workspace_webhook_trigger_rules",
  {
    id: uuidPrimaryKey(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => workspaceWebhooks.id, { onDelete: "cascade" }),
    type: webhookTriggerTypeEnum("type").notNull(),
    config: jsonb("config").$type<WebhookTriggerConfig>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index("workspace_webhook_trigger_rules_webhook_idx").on(table.webhookId),
    uniqueIndex("workspace_webhook_trigger_rules_webhook_position_idx").on(
      table.webhookId,
      table.position
    ),
  ]
)

export const trackableWebhookConnections = pgTable(
  "trackable_webhook_connections",
  {
    id: uuidPrimaryKey(),
    trackableId: uuid("trackable_id")
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => workspaceWebhooks.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("trackable_webhook_connections_trackable_idx").on(table.trackableId),
    index("trackable_webhook_connections_webhook_idx").on(table.webhookId),
    uniqueIndex("trackable_webhook_connections_trackable_webhook_idx").on(
      table.trackableId,
      table.webhookId
    ),
  ]
)

export const webhookDeliveryAttempts = pgTable(
  "webhook_delivery_attempts",
  {
    id: uuidPrimaryKey(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => workspaceWebhooks.id, { onDelete: "cascade" }),
    triggerRuleId: uuid("trigger_rule_id")
      .notNull()
      .references(() => workspaceWebhookTriggerRules.id, { onDelete: "cascade" }),
    trackableId: uuid("trackable_id")
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    usageEventId: uuid("usage_event_id").references(
      () => trackableApiUsageEvents.id,
      { onDelete: "cascade" }
    ),
    submissionId: uuid("submission_id").references(
      () => trackableFormSubmissions.id,
      { onDelete: "cascade" }
    ),
    provider: webhookProviderEnum("provider").notNull(),
    status: webhookDeliveryStatusEnum("status").notNull(),
    requestPayload: jsonb("request_payload")
      .$type<WebhookDeliveryRequestPayload>()
      .notNull(),
    responsePayload: jsonb("response_payload")
      .$type<WebhookDeliveryResponsePayload | null>(),
    errorMessage: text("error_message"),
    attemptedAt: occurredAt("attempted_at"),
  },
  (table) => [
    index("webhook_delivery_attempts_webhook_attempted_idx").on(
      table.webhookId,
      table.attemptedAt
    ),
    index("webhook_delivery_attempts_trackable_attempted_idx").on(
      table.trackableId,
      table.attemptedAt
    ),
    index("webhook_delivery_attempts_usage_event_idx").on(table.usageEventId),
    index("webhook_delivery_attempts_submission_idx").on(table.submissionId),
  ]
)

export const workspaceWebhooksRelations = relations(
  workspaceWebhooks,
  ({ many, one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceWebhooks.workspaceId],
      references: [workspaces.id],
    }),
    createdByUser: one(users, {
      fields: [workspaceWebhooks.createdByUserId],
      references: [users.id],
    }),
    triggerRules: many(workspaceWebhookTriggerRules),
    trackableConnections: many(trackableWebhookConnections),
    deliveryAttempts: many(webhookDeliveryAttempts),
  })
)

export const workspaceWebhookTriggerRulesRelations = relations(
  workspaceWebhookTriggerRules,
  ({ many, one }) => ({
    webhook: one(workspaceWebhooks, {
      fields: [workspaceWebhookTriggerRules.webhookId],
      references: [workspaceWebhooks.id],
    }),
    deliveryAttempts: many(webhookDeliveryAttempts),
  })
)

export const trackableWebhookConnectionsRelations = relations(
  trackableWebhookConnections,
  ({ one }) => ({
    trackable: one(trackableItems, {
      fields: [trackableWebhookConnections.trackableId],
      references: [trackableItems.id],
    }),
    webhook: one(workspaceWebhooks, {
      fields: [trackableWebhookConnections.webhookId],
      references: [workspaceWebhooks.id],
    }),
    createdByUser: one(users, {
      fields: [trackableWebhookConnections.createdByUserId],
      references: [users.id],
    }),
  })
)

export const webhookDeliveryAttemptsRelations = relations(
  webhookDeliveryAttempts,
  ({ one }) => ({
    webhook: one(workspaceWebhooks, {
      fields: [webhookDeliveryAttempts.webhookId],
      references: [workspaceWebhooks.id],
    }),
    triggerRule: one(workspaceWebhookTriggerRules, {
      fields: [webhookDeliveryAttempts.triggerRuleId],
      references: [workspaceWebhookTriggerRules.id],
    }),
    trackable: one(trackableItems, {
      fields: [webhookDeliveryAttempts.trackableId],
      references: [trackableItems.id],
    }),
    usageEvent: one(trackableApiUsageEvents, {
      fields: [webhookDeliveryAttempts.usageEventId],
      references: [trackableApiUsageEvents.id],
    }),
    submission: one(trackableFormSubmissions, {
      fields: [webhookDeliveryAttempts.submissionId],
      references: [trackableFormSubmissions.id],
    }),
  })
)
