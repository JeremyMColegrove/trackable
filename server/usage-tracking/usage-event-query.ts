import "server-only"

import { count, eq, max } from "drizzle-orm"

import { db } from "@/db"
import { trackableApiUsageEvents } from "@/db/schema"
import type {
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
} from "@/lib/usage-event-search"
import { UsageEventQueryPipeline } from "@/server/usage-tracking/usage-event-query-pipeline"
import { UsageEventSqlRepository } from "@/server/usage-tracking/usage-event-sql-repository"

const usageEventQueryPipeline = new UsageEventQueryPipeline(
  undefined,
  undefined,
  new UsageEventSqlRepository()
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
