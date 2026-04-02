import type { JobsOptions, Queue } from "bullmq"

import type {
  WebhookQueueContract,
  WebhookQueueJobData,
} from "@/server/webhooks/webhook.types"

export const WEBHOOK_QUEUE_NAME = "webhook-notifications"
export const WEBHOOK_QUEUE_JOB_NAME = "deliver-webhook-notification"

type BullMqWebhookQueueLike = Pick<Queue<WebhookQueueJobData>, "addBulk">

export class BullMqWebhookQueue implements WebhookQueueContract {
  constructor(
    private readonly queue: BullMqWebhookQueueLike,
    private readonly jobOptions: JobsOptions = {
      attempts: 3,
      backoff: {
        delay: 5_000,
        type: "exponential",
      },
      removeOnComplete: 1_000,
      removeOnFail: 1_000,
    }
  ) {}

  async enqueue(jobs: WebhookQueueJobData[]) {
    if (jobs.length === 0) {
      return
    }

    await this.queue.addBulk(
      jobs.map((job) => ({
        data: job,
        name: WEBHOOK_QUEUE_JOB_NAME,
        opts: {
          ...this.jobOptions,
          jobId: `${job.event.kind}:${job.event.id}:${job.webhook.id}:${job.triggerRule.id}`,
        },
      }))
    )
  }
}
