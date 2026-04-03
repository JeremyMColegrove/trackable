import "server-only"

import { Queue, Worker } from "bullmq"

import { getLogger } from "@/lib/logger"
import { getRuntimeConfig } from "@/lib/runtime-config"
import { createBullRedisConnection } from "@/server/redis/redis-client"
import { webhookDispatchService } from "@/server/webhooks/webhook-dispatch.service.singleton"
import {
  BullMqWebhookQueue,
  WEBHOOK_QUEUE_NAME,
} from "@/server/webhooks/webhook-queue"
import { WebhookProcessor } from "@/server/webhooks/webhook-processor"
import { webhookRepository } from "@/server/webhooks/webhook.repository"
import type { WebhookQueueJobData } from "@/server/webhooks/webhook.types"

const logger = getLogger("webhook-worker")

declare global {
  var __trackableWebhookQueue: BullMqWebhookQueue | undefined
  var __trackableWebhookWorkerStarted: boolean | undefined
}

function isWebhookQueueEnabled() {
  return getRuntimeConfig().webhooks.queue.enabled
}

function getWebhookWorkerRateLimit() {
  const queueConfig = getRuntimeConfig().webhooks.queue

  return {
    duration: queueConfig.rateLimitMs,
    max: queueConfig.rateLimitMax,
  }
}

export function getWebhookQueue() {
  if (!globalThis.__trackableWebhookQueue) {
    globalThis.__trackableWebhookQueue = new BullMqWebhookQueue(
      new Queue<WebhookQueueJobData>(WEBHOOK_QUEUE_NAME, {
        connection: createBullRedisConnection(),
      })
    )
  }

  return globalThis.__trackableWebhookQueue
}

export async function bootstrapWebhookWorker() {
  const enabled = isWebhookQueueEnabled()

  if (!enabled) {
    logger.warn(
      {
        enabled,
        source: "runtime-config",
      },
      "Webhook worker bootstrap skipped because it is disabled."
    )
    return null
  }

  if (globalThis.__trackableWebhookWorkerStarted) {
    return null
  }

  const processor = new WebhookProcessor(
    webhookRepository,
    webhookDispatchService
  )
  const rateLimit = getWebhookWorkerRateLimit()
  const worker = new Worker<WebhookQueueJobData>(
    WEBHOOK_QUEUE_NAME,
    async (job) => processor.process(job),
    {
      autorun: true,
      concurrency: 1,
      connection: createBullRedisConnection(),
      limiter: rateLimit,
    }
  )

  worker.on("completed", (job, result) => {
    const baseContext = {
      eventId: job.data.event.id,
      jobId: job.id,
      webhookId: job.data.webhook.id,
      outcome: result?.reason ?? "unknown",
      statusCode: result?.statusCode ?? null,
      failureKind: result?.failureKind ?? null,
    }

    if (result?.delivered) {
      logger.info(baseContext, "Completed webhook queue job.")
      return
    }

    logger.warn(
      {
        ...baseContext,
      },
      "Webhook queue job completed without delivery."
    )
  })

  worker.on("failed", (job, error) => {
    logger.error(
      {
        err: error,
        eventId: job?.data.event.id ?? null,
        jobId: job?.id ?? null,
        webhookId: job?.data.webhook.id ?? null,
      },
      "Webhook queue job failed."
    )
  })

  globalThis.__trackableWebhookWorkerStarted = true

  logger.info(
    {
      queueName: WEBHOOK_QUEUE_NAME,
      concurrency: 1,
      limiter: rateLimit,
    },
    "Webhook worker started."
  )

  return worker
}
