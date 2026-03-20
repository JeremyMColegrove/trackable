import "server-only"

import { CronJob } from "cron"

import type { BatchJob } from "@/server/batch/job"
import { getBatchLogger } from "@/server/batch/logger"
import { batchJobRunner } from "@/server/batch/runner"

const DEFAULT_TIME_ZONE = process.env.BATCH_SCHEDULER_TIME_ZONE ?? "UTC"

export class BatchScheduler {
  private readonly cronJobs: CronJob[] = []

  constructor(private readonly jobs: BatchJob[]) {}

  start() {
    const logger = getBatchLogger()

    for (const job of this.jobs) {
      const cronJob = CronJob.from({
        cronTime: job.schedule,
        start: false,
        timeZone: DEFAULT_TIME_ZONE,
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
          timeZone: DEFAULT_TIME_ZONE,
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
