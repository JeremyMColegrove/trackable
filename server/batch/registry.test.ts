import assert from "node:assert/strict"
import test from "node:test"

import { BatchJob } from "@/server/batch/job"
import { BatchJobRegistry } from "@/server/batch/registry"

class TestBatchJob extends BatchJob {
  readonly key = "test-job"
  readonly name = "Test Job"
  readonly schedule = "0 * * * * *"
  readonly timeoutMs = 1_000

  async run() {
    return {
      status: "success" as const,
      summary: "ok",
    }
  }
}

test("BatchJobRegistry rejects duplicate job keys", () => {
  const registry = new BatchJobRegistry()

  registry.register(new TestBatchJob())

  assert.throws(() => registry.register(new TestBatchJob()), {
    message: 'Batch job "test-job" is already registered.',
  })
})

test("BatchJob exposes a stable definition contract", () => {
  const job = new TestBatchJob()

  assert.deepEqual(job.getDefinition(), {
    key: "test-job",
    name: "Test Job",
    schedule: "0 * * * * *",
    concurrency: 1,
    timeoutMs: 1_000,
  })
})
