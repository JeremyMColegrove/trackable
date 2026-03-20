import "server-only"

import { and, count, eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { apiKeys, trackableApiUsageEvents, trackableItems } from "@/db/schema"

interface CleanupExpiredApiUsageInput {
  now?: Date
}

interface CleanupExpiredApiUsageResult {
  scannedTrackables: number
  affectedTrackables: number
  deletedEvents: number
  updatedApiKeys: number
}

type CleanupQueryRow = {
  deleted_events: number
  affected_trackables: number
  updated_api_keys: number
}

const API_LOG_RETENTION_DAYS_SQL = sql`(${trackableItems.settings} ->> 'apiLogRetentionDays')::int`

// `null` or a missing retention value means "never delete", so only numeric
// retention windows participate in cleanup.
const HAS_EXPIRING_RETENTION_SQL = sql`
  jsonb_typeof(${trackableItems.settings} -> 'apiLogRetentionDays') = 'number'
  and ${API_LOG_RETENTION_DAYS_SQL} > 0
`

export async function cleanupExpiredApiUsage(
  input: CleanupExpiredApiUsageInput = {}
): Promise<CleanupExpiredApiUsageResult> {
  const now = input.now ?? new Date()

  const [scannedTrackablesRow] = await db
    .select({
      count: count(trackableItems.id),
    })
    .from(trackableItems)
    .where(
      and(
        eq(trackableItems.kind, "api_ingestion"),
        HAS_EXPIRING_RETENTION_SQL
      )
    )

  const cleanupResult = await db.execute<CleanupQueryRow>(sql`
    with deleted_rows as (
      delete from ${trackableApiUsageEvents} as usage_events
      using ${trackableItems} as trackables
      where trackables.id = usage_events.trackable_id
        and trackables.kind = 'api_ingestion'
        and jsonb_typeof(trackables.settings -> 'apiLogRetentionDays') = 'number'
        and (trackables.settings ->> 'apiLogRetentionDays')::int > 0
        and usage_events.occurred_at <= ${now}
          - make_interval(
            days => (trackables.settings ->> 'apiLogRetentionDays')::int
          )
      returning usage_events.trackable_id, usage_events.api_key_id
    ),
    affected_trackables as (
      select distinct deleted_rows.trackable_id
      from deleted_rows
    ),
    affected_api_keys as (
      select distinct deleted_rows.api_key_id
      from deleted_rows
    ),
    updated_trackables as (
      update ${trackableItems} as trackables
      set
        api_usage_count = coalesce(stats.usage_count, 0),
        last_api_usage_at = stats.last_occurred_at,
        updated_at = ${now}
      from affected_trackables
      left join lateral (
        select
          count(*)::int as usage_count,
          max(usage_events.occurred_at) as last_occurred_at
        from ${trackableApiUsageEvents} as usage_events
        where usage_events.trackable_id = affected_trackables.trackable_id
      ) as stats on true
      where trackables.id = affected_trackables.trackable_id
      returning trackables.id
    ),
    updated_api_keys as (
      update ${apiKeys} as keys
      set
        usage_count = coalesce(stats.usage_count, 0),
        last_used_at = stats.last_used_at,
        updated_at = ${now}
      from affected_api_keys
      left join lateral (
        select
          count(*)::int as usage_count,
          max(usage_events.occurred_at) as last_used_at
        from ${trackableApiUsageEvents} as usage_events
        where usage_events.api_key_id = affected_api_keys.api_key_id
      ) as stats on true
      where keys.id = affected_api_keys.api_key_id
      returning keys.id
    )
    select
      coalesce((select count(*)::int from deleted_rows), 0) as deleted_events,
      coalesce((select count(*)::int from updated_trackables), 0) as affected_trackables,
      coalesce((select count(*)::int from updated_api_keys), 0) as updated_api_keys
  `)

  const summary = cleanupResult.rows[0]

  return {
    scannedTrackables: Number(scannedTrackablesRow?.count) || 0,
    affectedTrackables: Number(summary?.affected_trackables) || 0,
    deletedEvents: Number(summary?.deleted_events) || 0,
    updatedApiKeys: Number(summary?.updated_api_keys) || 0,
  }
}
