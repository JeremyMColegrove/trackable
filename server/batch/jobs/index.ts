import "server-only"

import { batchJobRegistry } from "@/server/batch/registry"
import { ClearExpiredApiLogsBatchJob } from "@/server/batch/jobs/clear-expired-api-logs-job"

export function createDefaultBatchJobs() {
  return [new ClearExpiredApiLogsBatchJob()]
}

let hasRegisteredDefaultBatchJobs = false

export function ensureDefaultBatchJobsRegistered() {
  if (hasRegisteredDefaultBatchJobs) {
    return batchJobRegistry.getAll()
  }

  for (const job of createDefaultBatchJobs()) {
    batchJobRegistry.register(job)
  }

  hasRegisteredDefaultBatchJobs = true

  return batchJobRegistry.getAll()
}
