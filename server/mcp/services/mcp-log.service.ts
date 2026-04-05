import "server-only"

import { and, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { trackableApiUsageEvents, apiKeys } from "@/db/schema"
import { buildAbsoluteUrl } from "@/lib/site-config"
import {
  buildMcpLogSummaryRows,
  type McpLogSummaryRow,
} from "@/lib/mcp-log-search"
import {
  getTrackableUsageEvents,
  getTrackableUsageSourceSnapshot,
} from "@/server/usage-tracking/usage-event-query"
import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import { McpToolError } from "@/server/mcp/errors/mcp-errors"
import { mcpTrackableService } from "@/server/mcp/services/mcp-trackable.service"

/** Input for the search_logs tool. */
export interface McpLogSearchInput {
  /** LiqE query string, e.g. `level:error message:"timeout"` */
  query?: string
  /** Payload field to group matching logs by, e.g. `event` or `route` */
  groupBy?: string
  /** ISO 8601 datetime string for the earliest log entry to include */
  from?: string
  /** ISO 8601 datetime string for the latest log entry to include */
  to?: string
  /** Number of results per page (1–100, default 25) */
  pageSize?: number
  /** Opaque cursor string for pagination (from previous response) */
  cursor?: string
}

/** Paginated result from the search_logs tool. */
export interface McpLogSearchResult {
  trackableId: string
  rows: McpLogSummaryRow[]
  totalMatched: number
  hasMore: boolean
  nextCursor: string | null
}

/** Full log detail returned by the get_log tool. */
export interface McpLogDetail {
  id: string
  trackableId: string
  occurredAt: string
  level: string | null
  message: string | null
  /** Complete raw payload as stored */
  payload: Record<string, unknown>
  metadata: Record<string, unknown> | null
  apiKey: {
    id: string
    name: string
    lastFour: string
  } | null
  uiLink: string
}

/**
 * MCP Log Service
 *
 * Implements search and detail retrieval for API ingestion log events.
 * All access is validated against the auth context before querying.
 */
export class McpLogService {
  /**
   * Searches API ingestion logs for a trackable using LiqE query syntax.
   *
   * Reuses the existing usage event query pipeline from
   * `server/usage-tracking/usage-event-query.ts` which handles LiqE parsing,
   * SQL compilation, pagination, and result mapping.
   */
  async searchLogs(
    trackableId: string,
    authContext: McpAuthContext,
    input: McpLogSearchInput
  ): Promise<McpLogSearchResult> {
    const trackable = await mcpTrackableService.assertAccess(
      trackableId,
      authContext
    )

    if (trackable.kind !== "api_ingestion") {
      throw new McpToolError(
        "FORBIDDEN",
        "This trackable does not store log events. Only api_ingestion trackables have logs."
      )
    }

    const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100)
    const aggregateField = input.groupBy?.trim() || null

    const sourceSnapshot = await getTrackableUsageSourceSnapshot(trackableId)

    const result = await getTrackableUsageEvents(
      {
        trackableId,
        query: input.query ?? "",
        aggregation: aggregateField ? "payload_field" : "none",
        aggregateField,
        sort: "lastOccurredAt",
        dir: "desc",
        from: input.from ?? null,
        to: input.to ?? null,
        cursor: input.cursor ?? null,
        pageSize,
      },
      sourceSnapshot
    )

    return {
      trackableId,
      rows: buildMcpLogSummaryRows(result.rows, trackableId),
      totalMatched: result.totalMatchedEvents,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    }
  }

  /**
   * Returns full detail for a single log event.
   *
   * Validates that the event belongs to the specified trackable and that
   * the auth context has access to that trackable before returning data.
   */
  async getLogDetail(
    trackableId: string,
    logId: string,
    authContext: McpAuthContext
  ): Promise<McpLogDetail> {
    const trackable = await mcpTrackableService.assertAccess(
      trackableId,
      authContext
    )

    if (trackable.kind !== "api_ingestion") {
      throw new McpToolError(
        "FORBIDDEN",
        "This trackable does not store log events. Only api_ingestion trackables have logs."
      )
    }

    const event = await db.query.trackableApiUsageEvents.findFirst({
      where: and(
        eq(trackableApiUsageEvents.id, logId),
        eq(trackableApiUsageEvents.trackableId, trackableId)
      ),
      with: {
        apiKey: {
          columns: { id: true, name: true, lastFour: true },
        },
      },
    })

    if (!event) {
      throw new McpToolError(
        "NOT_FOUND",
        "Log event not found or does not belong to this trackable."
      )
    }

    const payload = event.payload as Record<string, unknown>
    const level = (payload.level as string | undefined) ?? null
    const message = (payload.message as string | undefined) ?? null

    return {
      id: event.id,
      trackableId: event.trackableId,
      occurredAt: event.occurredAt.toISOString(),
      level,
      message,
      payload,
      metadata: event.metadata as Record<string, unknown> | null,
      apiKey: event.apiKey
        ? {
            id: event.apiKey.id,
            name: event.apiKey.name,
            lastFour: event.apiKey.lastFour,
          }
        : null,
      uiLink: buildAbsoluteUrl(
        `/dashboard/trackables/${trackableId}?logId=${logId}`
      ).toString(),
    }
  }
}

export const mcpLogService = new McpLogService()
