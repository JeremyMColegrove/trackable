import { relations } from "drizzle-orm"
import { index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"

import {
  createdByUserId,
  expiresAt,
  nullableTimestamp,
  timestamps,
  uuidPrimaryKey,
  usageCount,
} from "@/db/schema/_shared"
import type { McpTokenCapabilities } from "@/lib/mcp-token-capabilities"
import { users } from "@/db/schema/users"

/**
 * Machine-style access tokens for MCP connections.
 *
 * These are distinct from the `api_keys` table, which is used for
 * API log ingestion. MCP tokens are scoped to MCP tool access only
 * and carry per-token capability definitions.
 *
 * Token format: `trk_mcp_<24 bytes base64url>`
 * Only the first 20 chars (key_prefix) and SHA256 hash are stored.
 */
export const mcpAccessTokens = pgTable(
  "mcp_access_tokens",
  {
    id: uuidPrimaryKey(),
    createdByUserId: createdByUserId(),
    name: text().notNull(),
    /** First 20 characters of the raw token, used as the cache/lookup key */
    keyPrefix: text().notNull(),
    /** SHA256 hex digest of the full raw token */
    secretHash: text().notNull(),
    /** Last 4 characters for display only */
    lastFour: text().notNull(),
    /** Scoped capabilities: which tools and which trackables */
    capabilities: jsonb().$type<McpTokenCapabilities>().notNull(),
    /** "active" or "revoked" */
    status: text().notNull().default("active"),
    expiresAt: expiresAt(),
    lastUsedAt: nullableTimestamp(),
    usageCount: usageCount(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("mcp_access_tokens_key_prefix_idx").on(table.keyPrefix),
    index("mcp_access_tokens_status_idx").on(table.status),
    index("mcp_access_tokens_created_by_idx").on(table.createdByUserId),
  ]
)

export const mcpAccessTokensRelations = relations(
  mcpAccessTokens,
  ({ one }) => ({
    createdBy: one(users, {
      fields: [mcpAccessTokens.createdByUserId],
      references: [users.id],
    }),
  })
)
