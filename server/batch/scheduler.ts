import "server-only"

import { CronJob } from "cron"

import { getRuntimeConfig } from "@/lib/runtime-config"
import type { BatchJob } from "@/server/batch/job"
import { getBatchLogger } from "@/server/batch/logger"
import { batchJobRunner } from "@/server/batch/runner"

export class BatchScheduler {
  private readonly cronJobs: CronJob[] = []

  constructor(private readonly jobs: BatchJob[]) {}

  start() {
    const logger = getBatchLogger()
    const defaultTimeZone = getRuntimeConfig().batch.schedulerTimeZone

    for (const job of this.jobs) {
      const cronJob = CronJob.from({
        cronTime: job.schedule,
        start: false,
        timeZone: defaultTimeZone,
        onTick: () => {
          void batchJobRunner.run(job, "cron")
        },
      })

      cronJob.start()
      this.cronJobs.push(cronJob)

      logger.info(
        {
          jobKey: job.key,
          schedule: job.schedule,
          timeZone: defaultTimeZone,
          concurrency: job.concurrency,
          timeoutMs: job.timeoutMs,
        },
        "Registered cron batch job."
      )
    }
  }

  stop() {
    for (const cronJob of this.cronJobs) {
      cronJob.stop()
    }

    this.cronJobs.length = 0
  }
}
