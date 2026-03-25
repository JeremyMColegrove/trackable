import "server-only"

import { ensureDefaultBatchJobsRegistered } from "@/server/batch/jobs"
import { getBatchLogger } from "@/server/batch/logger"
import { syncBatchJobDefinitions } from "@/server/batch/repository"
import { BatchScheduler } from "@/server/batch/scheduler"

declare global {
  var __trackableBatchSchedulerStarted: boolean | undefined
}

function isBatchSchedulerEnabled() {
  return process.env.BATCH_SCHEDULER_ENABLED !== "false"
}

export async function bootstrapBatchScheduler() {
  const logger = getBatchLogger()

  if (!isBatchSchedulerEnabled()) {
    logger.info("Batch scheduler bootstrap skipped because it is disabled.")
    return null
  }

  if (globalThis.__trackableBatchSchedulerStarted) {
    return null
  }

  const jobs = ensureDefaultBatchJobsRegistered()

  await syncBatchJobDefinitions(jobs.map((job) => job.getDefinition()))

  const scheduler = new BatchScheduler(jobs)
  scheduler.start()

  globalThis.__trackableBatchSchedulerStarted = true

  logger.info({ jobCount: jobs.length }, "Batch scheduler started.")

  return scheduler
}
