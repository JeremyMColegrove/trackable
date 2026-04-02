import assert from "node:assert/strict"
import test from "node:test"

import {
  BullMqWebhookQueue,
  WEBHOOK_QUEUE_JOB_NAME,
} from "@/server/webhooks/webhook-queue"
import type { WebhookQueueJobData } from "@/server/webhooks/webhook.types"

class StubBullQueue {
  public jobs: Array<Record<string, unknown>> = []

  async addBulk(jobs: Array<Record<string, unknown>>) {
    this.jobs.push(...jobs)
  }
}

function buildJobData(): WebhookQueueJobData {
  return {
    event: {
      kind: "usage_event",
      id: "event-1",
      occurredAt: "2026-03-31T12:00:00.000Z",
      trackableId: "trackable-1",
      workspaceId: "workspace-1",
    },
    webhook: {
      id: "webhook-1",
      workspaceId: "workspace-1",
      name: "Error webhook",
      provider: "generic",
      enabled: true,
      config: {
        provider: "generic",
        url: "https://example.com/hook",
        headers: {},
      },
      triggerRules: [],
    },
    triggerRule: {
      id: "rule-1",
      webhookId: "webhook-1",
      enabled: true,
      position: 0,
      config: {
        type: "log_match",
        liqeQuery: "level:error",
      },
    },
  }
}

test("BullMqWebhookQueue enqueues one BullMQ job per webhook trigger", async () => {
  const bullQueue = new StubBullQueue()
  const queue = new BullMqWebhookQueue(bullQueue as never)

  await queue.enqueue([buildJobData()])

  assert.equal(bullQueue.jobs.length, 1)
  assert.equal(bullQueue.jobs[0]?.name, WEBHOOK_QUEUE_JOB_NAME)
  assert.equal(
    (bullQueue.jobs[0]?.opts as { jobId: string }).jobId,
    "usage_event:event-1:webhook-1:rule-1"
  )
})

test("BullMqWebhookQueue does not call BullMQ when there is nothing to enqueue", async () => {
  const bullQueue = new StubBullQueue()
  const queue = new BullMqWebhookQueue(bullQueue as never)

  await queue.enqueue([])

  assert.equal(bullQueue.jobs.length, 0)
})
