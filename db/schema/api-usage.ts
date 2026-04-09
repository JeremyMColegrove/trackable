import { relations, sql } from "drizzle-orm"
import {
  index,
  jsonb,
  pgTable,
  uniqueIndex,
  uuid,
  text,
} from "drizzle-orm/pg-core"

import {
  expiresAt,
  nullableTimestamp,
  occurredAt,
  timestamps,
  usageCount,
  uuidPrimaryKey,
} from "@/db/schema/_shared"
import { apiKeyStatusEnum } from "@/db/schema/enums"
import { workspaces } from "@/db/schema/team"
import type { UsageEventMetadata, UsageEventPayload } from "@/db/schema/types"
import { trackableItems } from "@/db/schema/trackables"

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuidPrimaryKey(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid().references(() => trackableItems.id, {
      onDelete: "cascade",
    }),
    name: text().notNull(),
    keyPrefix: text().notNull(),
    secretHash: text().notNull(),
    lastFour: text().notNull(),
    status: apiKeyStatusEnum().default("active").notNull(),
    expiresAt: expiresAt(),
    lastUsedAt: nullableTimestamp(),
    usageCount: usageCount(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("api_keys_key_prefix_idx").on(table.keyPrefix),
    index("api_keys_workspace_idx").on(table.workspaceId),
    index("api_keys_project_idx").on(table.projectId),
    index("api_keys_status_idx").on(table.status),
  ]
)

export const trackableApiUsageEvents = pgTable(
  "trackable_api_usage_events",
  {
    id: uuidPrimaryKey(),
    trackableId: uuid()
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    apiKeyId: uuid()
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    requestId: text(),
    occurredAt: occurredAt(),
    payload: jsonb().$type<UsageEventPayload>().notNull(),
    metadata: jsonb().$type<UsageEventMetadata>(),
  },
  (table) => [
    uniqueIndex("trackable_api_usage_events_request_id_idx").on(
      table.requestId
    ),
    index("trackable_api_usage_events_trackable_occurred_idx").on(
      table.trackableId,
      table.occurredAt
    ),
    index("trackable_api_usage_events_trackable_occurred_id_idx").on(
      table.trackableId,
      table.occurredAt,
      table.id
    ),
    index("trackable_api_usage_events_api_key_occurred_idx").on(
      table.apiKeyId,
      table.occurredAt
    ),
    index("trackable_api_usage_events_payload_gin_idx").using(
      "gin",
      table.payload
    ),
    index("trackable_api_usage_events_metadata_gin_idx")
      .using("gin", table.metadata)
      .where(sql`${table.metadata} is not null`),
  ]
)

export const apiKeysRelations = relations(apiKeys, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [apiKeys.workspaceId],
    references: [workspaces.id],
  }),
  project: one(trackableItems, {
    fields: [apiKeys.projectId],
    references: [trackableItems.id],
  }),
  usageEvents: many(trackableApiUsageEvents),
}))

export const trackableApiUsageEventsRelations = relations(
  trackableApiUsageEvents,
  ({ one }) => ({
    trackable: one(trackableItems, {
      fields: [trackableApiUsageEvents.trackableId],
      references: [trackableItems.id],
    }),
    apiKey: one(apiKeys, {
      fields: [trackableApiUsageEvents.apiKeyId],
      references: [apiKeys.id],
    }),
  })
)
