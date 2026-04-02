import assert from "node:assert/strict"
import test from "node:test"

import { WebhookTriggerService } from "@/server/webhooks/webhook-trigger.service"
import type {
  AttachedWebhookRecord,
  WebhookQueueJobData,
} from "@/server/webhooks/webhook.types"

class StubRepository {
  constructor(private readonly webhooks: AttachedWebhookRecord[]) {}

  async listTrackableWebhooks() {
    return this.webhooks
  }
}

class RecordingQueue {
  public jobs: WebhookQueueJobData[] = []

  async enqueue(jobs: WebhookQueueJobData[]) {
    this.jobs.push(...jobs)
  }
}

class ThrowingQueue {
  async enqueue() {
    throw new Error("queue failed")
  }
}

function buildWebhook(): AttachedWebhookRecord {
  return {
    trackableId: "trackable-1",
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
    triggerRules: [
      {
        id: "rule-1",
        webhookId: "webhook-1",
        enabled: true,
        position: 0,
        config: {
          type: "log_match",
          liqeQuery: "level:error",
        },
      },
      {
        id: "rule-2",
        webhookId: "webhook-1",
        enabled: false,
        position: 1,
        config: {
          type: "log_match",
          liqeQuery: "level:warn",
        },
      },
    ],
  }
}

function buildRecordedEvent() {
  return {
    id: "event-1",
    occurredAt: new Date("2026-03-31T12:00:00.000Z"),
    trackableId: "trackable-1",
    workspaceId: "workspace-1",
  }
}

test("handleUsageEventRecorded enqueues one BullMQ job per enabled trigger rule", async () => {
  const queue = new RecordingQueue()
  const service = new WebhookTriggerService(
    new StubRepository([buildWebhook()]) as never,
    queue
  )

  await service.handleUsageEventRecorded(buildRecordedEvent())

  assert.equal(queue.jobs.length, 1)
  assert.equal(queue.jobs[0]?.event.id, "event-1")
  assert.equal(queue.jobs[0]?.webhook.id, "webhook-1")
  assert.equal(queue.jobs[0]?.triggerRule.id, "rule-1")
})

test("handleUsageEventRecorded ignores disabled or non-deliverable webhooks", async () => {
  const queue = new RecordingQueue()
  const service = new WebhookTriggerService(
    new StubRepository([
      {
        ...buildWebhook(),
        enabled: false,
      },
      {
        ...buildWebhook(),
        id: "webhook-2",
        triggerRules: [
          {
            id: "rule-3",
            webhookId: "webhook-2",
            enabled: false,
            position: 0,
            config: {
              type: "log_match",
              liqeQuery: "*",
            },
          },
        ],
      },
    ]) as never,
    queue
  )

  await service.handleUsageEventRecorded(buildRecordedEvent())

  assert.equal(queue.jobs.length, 0)
})

test("handleUsageEventRecorded swallows queue failures", async () => {
  const service = new WebhookTriggerService(
    new StubRepository([buildWebhook()]) as never,
    new ThrowingQueue() as never
  )

  await assert.doesNotReject(() =>
    service.handleUsageEventRecorded(buildRecordedEvent())
  )
})
