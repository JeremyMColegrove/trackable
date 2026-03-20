import { hostname } from "node:os"

import { BatchJob } from "@/server/batch/job"

export class RuntimeHeartbeatBatchJob extends BatchJob {
  readonly key = "runtime-heartbeat"
  readonly name = "Runtime Heartbeat"
  readonly schedule = "0 0 * * * *"
  readonly timeoutMs = 30_000

  async run() {
    return {
      status: "success" as const,
      summary: "Scheduler heartbeat recorded.",
      metadata: {
        hostname: hostname(),
        pid: process.pid,
      },
    }
  }
}
