import "server-only"

import { db } from "@/db"
import { getBatchLogger } from "@/server/batch/logger"
import {
  attachRunToBatchLease,
  completeBatchJobRun,
  createBatchJobRun,
  getBatchJobByKey,
  markBatchJobStarted,
  recordSkippedManualRun,
  releaseBatchLease,
  syncBatchJobDefinitions,
  tryAcquireBatchLease,
} from "@/server/batch/repository"
import type { BatchJob } from "@/server/batch/job"
import { batchJobResultSchema } from "@/server/batch/types"
import type { BatchJobRunError, BatchJobTrigger } from "@/server/batch/types"

class BatchJobTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BatchJobTimeoutError"
  }
}

function serializeError(error: unknown): BatchJobRunError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    name: "UnknownError",
    message: "An unknown batch job error occurred.",
  }
}

async function createTimedExecution<T>(
  timeoutMs: number,
  signal: AbortSignal,
  run: () => Promise<T>
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new BatchJobTimeoutError(`Batch job timed out after ${timeoutMs}ms.`)
      )
    }, timeoutMs)

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout)
        reject(
          new BatchJobTimeoutError(`Batch job timed out after ${timeoutMs}ms.`)
        )
      },
      { once: true }
    )

    void run()
      .then((result) => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

export class BatchJobRunner {
  async run(job: BatchJob, trigger: BatchJobTrigger) {
    await syncBatchJobDefinitions([job.getDefinition()])

    const jobRecord = await getBatchJobByKey(job.key)

    if (!jobRecord) {
      throw new Error(`Batch job "${job.key}" was not synchronized.`)
    }

    if (!jobRecord.enabled) {
      if (trigger === "manual") {
        await recordSkippedManualRun({
          job: jobRecord,
          trigger,
          summary: "Job is disabled.",
        })
      }

      return {
        status: "skipped" as const,
        summary: "Job is disabled.",
      }
    }

    const lease = await tryAcquireBatchLease({
      job: jobRecord,
      timeoutMs: job.timeoutMs,
    })

    if (!lease) {
      if (trigger === "manual") {
        await recordSkippedManualRun({
          job: jobRecord,
          trigger,
          summary: "Job is already running.",
        })
      }

      return {
        status: "skipped" as const,
        summary: "Job is already running.",
      }
    }

    const startedAt = new Date()
    const run = await createBatchJobRun({
      batchJobId: jobRecord.id,
      jobKey: jobRecord.key,
      trigger,
      status: "running",
      startedAt,
    })

    await attachRunToBatchLease({
      jobKey: jobRecord.key,
      lockedBy: lease.lockedBy,
      runId: run.id,
    })
    await markBatchJobStarted(jobRecord.id, startedAt)

    const logger = getBatchLogger({
      jobKey: jobRecord.key,
      runId: run.id,
      trigger,
    })
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), job.timeoutMs)

    logger.info({ schedule: job.schedule }, "Starting batch job run.")

    try {
      const result = batchJobResultSchema.parse(
        await createTimedExecution(job.timeoutMs, abortController.signal, () =>
          job.run({
            db,
            now: startedAt,
            runId: run.id,
            signal: abortController.signal,
            logger,
          })
        )
      )
      const completedAt = new Date()

      await completeBatchJobRun({
        job: jobRecord,
        runId: run.id,
        status: result.status,
        summary: result.summary,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        metadata: result.metadata,
      })

      logger.info({ status: result.status }, "Completed batch job run.")

      return result
    } catch (error) {
      const completedAt = new Date()
      const errorDetails = serializeError(error)

      await completeBatchJobRun({
        job: jobRecord,
        runId: run.id,
        status: "failed",
        summary: errorDetails.message,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        errorDetails,
      })

      logger.error({ error: errorDetails }, "Batch job run failed.")

      return {
        status: "failed" as const,
        summary: errorDetails.message,
      }
    } finally {
      clearTimeout(timeoutId)
      await releaseBatchLease(jobRecord.key, lease.lockedBy)
    }
  }
}

export const batchJobRunner = new BatchJobRunner()
