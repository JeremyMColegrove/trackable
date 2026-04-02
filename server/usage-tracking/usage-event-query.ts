import "server-only"

import { count, eq, max } from "drizzle-orm"

import { db } from "@/db"
import { trackableApiUsageEvents } from "@/db/schema"
import type {
  UsageEventContextBounds,
  UsageEventContextInput,
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
} from "@/lib/usage-event-search"
import { UsageEventQueryPipeline } from "@/server/usage-tracking/usage-event-query-pipeline"
import { UsageEventSqlRepository } from "@/server/usage-tracking/usage-event-sql-repository"

const usageEventSqlRepository = new UsageEventSqlRepository(db)
const usageEventQueryPipeline = new UsageEventQueryPipeline(
  undefined,
  undefined,
  usageEventSqlRepository
)

export async function getTrackableUsageSourceSnapshot(
  trackableId: string
): Promise<UsageEventSourceSnapshot> {
  const [summary] = await db
    .select({
      totalEventCount: count(trackableApiUsageEvents.id),
      latestOccurredAt: max(trackableApiUsageEvents.occurredAt),
    })
    .from(trackableApiUsageEvents)
    .where(eq(trackableApiUsageEvents.trackableId, trackableId))

  return {
    totalEventCount: Number(summary?.totalEventCount) || 0,
    latestOccurredAt: summary?.latestOccurredAt?.toISOString() ?? null,
  }
}

export async function getTrackableUsageEvents(
  input: UsageEventSearchInput,
  sourceSnapshot: UsageEventSourceSnapshot
) {
  return usageEventQueryPipeline.execute(input, sourceSnapshot)
}

export async function getTrackableUsageEventContextBounds(
  input: UsageEventContextInput
): Promise<UsageEventContextBounds> {
  const rows = await usageEventSqlRepository.fetchSurroundingFlatRows({
    afterCount: input.after,
    beforeCount: input.before,
    eventId: input.eventId,
    trackableId: input.trackableId,
  })

  const firstRow = rows.at(-1)
  const lastRow = rows[0]

  return {
    from: firstRow?.occurredAt.toISOString() ?? null,
    to: lastRow?.occurredAt.toISOString() ?? null,
  }
}
