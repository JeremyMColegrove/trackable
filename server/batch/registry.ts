import { BatchJob } from "@/server/batch/job"

export class BatchJobRegistry {
  private readonly jobs = new Map<string, BatchJob>()

  register(job: BatchJob) {
    if (this.jobs.has(job.key)) {
      throw new Error(`Batch job "${job.key}" is already registered.`)
    }

    this.jobs.set(job.key, job)
    return job
  }

  getAll() {
    return Array.from(this.jobs.values())
  }

  getByKey(key: string) {
    return this.jobs.get(key) ?? null
  }
}

export const batchJobRegistry = new BatchJobRegistry()
