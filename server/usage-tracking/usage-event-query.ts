import "server-only"

import { and, count, eq, gte, lte, max } from "drizzle-orm"

import { db } from "@/db"
import { trackableApiUsageEvents } from "@/db/schema"
import type {
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
} from "@/lib/usage-event-search"
import { apiLogCache } from "@/server/redis/api-log-cache.repository"

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

export async function getTrackableUsageAggregateFields(trackableId: string) {
  const { logs: events } = await apiLogCache.getLimitedLogsForTrackable(
    trackableId
  )

  const fields = new Set<string>()

  for (const event of events) {
    for (const key of Object.keys(event.payload)) {
      fields.add(key)
    }
  }

  return Array.from(fields).sort((left, right) => left.localeCompare(right))
}

export async function getTrackableUsageEvents(input: UsageEventSearchInput) {
  const { logs: initialLogs, maxLogsFound } =
    await apiLogCache.getLimitedLogsForTrackable(input.trackableId)
  let logs = initialLogs

  if (input.from) {
    const fromTime = new Date(input.from).getTime()
    logs = logs.filter((log) => log.occurredAt.getTime() >= fromTime)
  }

  if (input.to) {
    const toTime = new Date(input.to).getTime()
    logs = logs.filter((log) => log.occurredAt.getTime() <= toTime)
  }

  return {
    logs,
    maxLogsFound,
  }
}
