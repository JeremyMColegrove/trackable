import type {
  BatchJobContext,
  BatchJobDefinition,
  BatchJobResult,
} from "@/server/batch/types"

export abstract class BatchJob {
  abstract readonly key: string
  abstract readonly name: string
  abstract readonly schedule: string
  abstract readonly timeoutMs: number

  get concurrency() {
    return 1
  }

  getDefinition(): BatchJobDefinition {
    return {
      key: this.key,
      name: this.name,
      schedule: this.schedule,
      concurrency: this.concurrency,
      timeoutMs: this.timeoutMs,
    }
  }

  abstract run(context: BatchJobContext): Promise<BatchJobResult>
}
