import { BatchJob } from "@/server/batch/job"
import type { BatchJobContext } from "@/server/batch/types"
import { cleanupExpiredApiUsage } from "@/server/usage-tracking/cleanup-expired-api-usage"

export class ClearExpiredApiLogsBatchJob extends BatchJob {
  readonly key = "clear-expired-api-logs"
  readonly name = "Clear Expired API Logs"
  readonly schedule = "0 0 * * * *"
  readonly timeoutMs = 10 * 60 * 1000

  async run(context: BatchJobContext) {
    const summary = await cleanupExpiredApiUsage({
      db: context.db,
      logger: context.logger,
      now: context.now,
    })

    context.logger.info(summary, "Expired API usage cleanup completed.")

    return {
      status: "success" as const,
      summary:
        summary.deletedEvents > 0
          ? `Deleted ${summary.deletedEvents.toLocaleString()} expired API log events.`
          : "No expired API log events needed cleanup.",
      metadata: {
        scannedTrackables: summary.scannedTrackables,
        affectedTrackables: summary.affectedTrackables,
        deletedEvents: summary.deletedEvents,
        updatedApiKeys: summary.updatedApiKeys,
      },
    }
  }
}
