import "server-only"
import { createHash } from "node:crypto"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { mcpAccessTokens } from "@/db/schema"
import {
  McpAuthContextImpl,
  type McpAuthContext,
} from "@/server/mcp/auth/mcp-auth-context"

/**
 * Validates a raw `trk_mcp_*` Bearer token against the mcp_access_tokens table.
 *
 * Returns a fully-resolved McpAuthContext on success, or null if the token is
 * invalid, revoked, or expired.
 *
 * Only called when `config.features.customMCPServerTokens` is true.
 */
export async function validateCustomMcpToken(
  rawToken: string
): Promise<McpAuthContext | null> {
  if (!rawToken.startsWith("trk_mcp_")) {
    return null
  }

  const prefix = rawToken.slice(0, 20)
  const hash = createHash("sha256").update(rawToken).digest("hex")

  const token = await db.query.mcpAccessTokens.findFirst({
    where: and(
      eq(mcpAccessTokens.keyPrefix, prefix),
      eq(mcpAccessTokens.secretHash, hash),
      eq(mcpAccessTokens.status, "active")
    ),
  })

  if (!token) {
    return null
  }

  if (token.expiresAt && token.expiresAt < new Date()) {
    return null
  }

  // Fire-and-forget usage tracking — do not await
  db.update(mcpAccessTokens)
    .set({
      lastUsedAt: new Date(),
      usageCount: token.usageCount + 1,
    })
    .where(eq(mcpAccessTokens.id, token.id))
    .catch(() => {
      // Non-critical — ignore failures
    })

  return new McpAuthContextImpl({
    userId: token.createdByUserId,
    scopes: [],
    tools: token.capabilities.tools,
    workspaceIds: token.capabilities.workspaceIds,
    trackableIds: token.capabilities.trackableIds,
  })
}
