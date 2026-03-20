import assert from "node:assert/strict"
import test from "node:test"

import { RuntimeHeartbeatBatchJob } from "@/server/batch/jobs/runtime-heartbeat-job"

test("RuntimeHeartbeatBatchJob returns a success payload", async () => {
  const job = new RuntimeHeartbeatBatchJob()

  const result = await job.run()

  assert.equal(result.status, "success")
  assert.equal(result.summary, "Scheduler heartbeat recorded.")
  assert.equal(typeof result.metadata?.hostname, "string")
  assert.equal(typeof result.metadata?.pid, "number")
})
