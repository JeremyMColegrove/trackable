import "server-only"

import { getRuntimeConfig } from "@/lib/runtime-config"
import { ensureDefaultBatchJobsRegistered } from "@/server/batch/jobs"
import { getBatchLogger } from "@/server/batch/logger"
import { syncBatchJobDefinitions } from "@/server/batch/repository"
import { BatchScheduler } from "@/server/batch/scheduler"

declare global {
  var __trackableBatchSchedulerStarted: boolean | undefined
}

function isBatchSchedulerEnabled() {
  return getRuntimeConfig().features.batchSchedulerEnabled
}

export async function bootstrapBatchScheduler() {
  const logger = getBatchLogger()
  const enabled = isBatchSchedulerEnabled()

  if (!enabled) {
    logger.warn(
      {
        enabled,
        source: "runtime-config",
      },
      "Batch scheduler bootstrap skipped because it is disabled."
    )
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

  logger.info(
    {
      jobCount: jobs.length,
      jobs: jobs.map((job) => ({
        key: job.key,
        schedule: job.schedule,
        timeoutMs: job.timeoutMs,
      })),
      timeZone: getRuntimeConfig().batch.schedulerTimeZone,
    },
    "Batch scheduler started."
  )

  return scheduler
}
