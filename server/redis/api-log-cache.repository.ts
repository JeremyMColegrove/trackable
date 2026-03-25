import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { trackableApiUsageEvents } from "@/db/schema"
import { BaseCacheRepository } from "./base-cache.repository"

export type CachedLogEvent = Awaited<ReturnType<typeof fetchLogsFromDb>>[number]
export const MAX_VISIBLE_API_LOGS = 10_000
const MAX_CACHED_API_LOGS = MAX_VISIBLE_API_LOGS + 1

async function fetchLogsFromDb(trackableId: string) {
  return db.query.trackableApiUsageEvents.findMany({
    where: eq(trackableApiUsageEvents.trackableId, trackableId),
    with: {
      apiKey: {
        columns: {
          id: true,
          name: true,
          keyPrefix: true,
          lastFour: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.occurredAt)],
    limit: MAX_CACHED_API_LOGS,
  })
}

export class ApiLogCacheRepository extends BaseCacheRepository<CachedLogEvent[]> {
  constructor() {
    super("api-logs", 300) // 5 minutes TTL default
  }

  protected async fetchFallback(trackableId: string): Promise<CachedLogEvent[] | null> {
    const logs = await fetchLogsFromDb(trackableId)
    // Always return an array (even empty) so we cache empty states if desired,
    // though for trackables, they might just have 0 logs.
    return logs
  }

  async getLogsForTrackable(trackableId: string): Promise<CachedLogEvent[]> {
    const logs = await this.get(trackableId)
    return logs || []
  }

  async getLimitedLogsForTrackable(trackableId: string): Promise<{
    logs: CachedLogEvent[]
    maxLogsFound: boolean
  }> {
    const logs = await this.getLogsForTrackable(trackableId)

    return {
      logs: logs.slice(0, MAX_VISIBLE_API_LOGS),
      maxLogsFound: logs.length > MAX_VISIBLE_API_LOGS,
    }
  }

  async addLogToTrackable(trackableId: string, log: CachedLogEvent): Promise<void> {
    const cached = await this.getRaw(trackableId)
    if (!cached) {
      // If there's no cache, do nothing; the next read will load the full fresh list from DB
      return
    }

    // Prepend the new log to keep sort order (recent first)
    cached.unshift(log)
    await this.set(trackableId, cached.slice(0, MAX_CACHED_API_LOGS))
  }
}

export const apiLogCache = new ApiLogCacheRepository()
