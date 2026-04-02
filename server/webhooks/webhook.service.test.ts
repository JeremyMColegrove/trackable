import assert from "node:assert/strict"
import test from "node:test"

import { WebhookService } from "@/server/webhooks/webhook.service"
import type {
  AttachedWebhookRecord,
  WorkspaceWebhookRecord,
} from "@/server/webhooks/webhook.types"

class StubDispatchService {
  public calls: Array<Record<string, unknown>> = []
  constructor(
    private readonly result: {
      ok: boolean
      response: { status: number; body: string } | null
      errorMessage: string | null
    } = {
      ok: true,
      response: {
        status: 204,
        body: "",
      },
      errorMessage: null,
    }
  ) {}

  async sendTest(input: Record<string, unknown>) {
    this.calls.push(input)
    return this.result
  }
}

class InMemoryWebhookRepository {
  constructor(
    private readonly webhooks: WorkspaceWebhookRecord[],
    private readonly trackables: Record<string, { workspaceId: string }>,
    private readonly attachments = new Map<string, Set<string>>()
  ) {}

  async listWorkspaceWebhooks(workspaceId: string) {
    return this.webhooks.filter((webhook) => webhook.workspaceId === workspaceId)
  }

  async getWorkspaceWebhookById(webhookId: string) {
    return this.webhooks.find((webhook) => webhook.id === webhookId) ?? null
  }

  async createWebhook() {
    return "unused"
  }

  async updateWebhook() {}

  async deleteWebhook() {}

  async getTrackable(trackableId: string) {
    const trackable = this.trackables[trackableId]
    return trackable
      ? {
          id: trackableId,
          workspaceId: trackable.workspaceId,
          kind: "api_ingestion" as const,
        }
      : null
  }

  async attachWebhookToTrackable(input: {
    trackableId: string
    webhookId: string
  }) {
    const existing = this.attachments.get(input.trackableId) ?? new Set<string>()
    existing.add(input.webhookId)
    this.attachments.set(input.trackableId, existing)
  }

  async detachWebhookFromTrackable(input: {
    trackableId: string
    webhookId: string
  }) {
    this.attachments.get(input.trackableId)?.delete(input.webhookId)
  }

  async listTrackableWebhooks(trackableId: string): Promise<AttachedWebhookRecord[]> {
    const attachedIds = this.attachments.get(trackableId) ?? new Set<string>()

    return this.webhooks
      .filter((webhook) => attachedIds.has(webhook.id))
      .map((webhook) => ({
        ...webhook,
        trackableId,
      }))
  }
}

function buildWebhookRecord(): WorkspaceWebhookRecord {
  return {
    id: "webhook-1",
    workspaceId: "workspace-1",
    name: "Shared error webhook",
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
    ],
  }
}

test("workspace webhooks can be reused across multiple trackables in the same workspace", async () => {
  const repository = new InMemoryWebhookRepository(
    [buildWebhookRecord()],
    {
      "trackable-1": { workspaceId: "workspace-1" },
      "trackable-2": { workspaceId: "workspace-1" },
    }
  )
  const service = new WebhookService(repository as never, new StubDispatchService() as never)

  await service.attachWebhookToTrackable(
    {
      trackableId: "trackable-1",
      webhookId: "webhook-1",
    },
    "user-1"
  )
  await service.attachWebhookToTrackable(
    {
      trackableId: "trackable-2",
      webhookId: "webhook-1",
    },
    "user-1"
  )

  const [trackableOneWebhooks, trackableTwoWebhooks] = await Promise.all([
    service.listTrackableWebhooks("trackable-1"),
    service.listTrackableWebhooks("trackable-2"),
  ])

  assert.equal(trackableOneWebhooks[0]?.id, "webhook-1")
  assert.equal(trackableTwoWebhooks[0]?.id, "webhook-1")
  assert.equal(trackableOneWebhooks[0]?.workspaceId, "workspace-1")
  assert.equal(trackableTwoWebhooks[0]?.workspaceId, "workspace-1")
})

test("webhook test delivery reuses the first enabled trigger rule", async () => {
  const repository = new InMemoryWebhookRepository([buildWebhookRecord()], {})
  const dispatchService = new StubDispatchService()
  const service = new WebhookService(
    repository as never,
    dispatchService as never
  )

  const result = await service.testWebhook({
    workspaceId: "workspace-1",
    webhookId: "webhook-1",
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 204)
  assert.equal(dispatchService.calls.length, 1)

  const firstCall = dispatchService.calls[0] as {
    triggerRule: { id: string }
    event: { payload: { event: string } }
  }
  assert.equal(firstCall.triggerRule.id, "rule-1")
  assert.equal(firstCall.event.payload.event, "webhook.test")
})

test("webhook test delivery throws when the downstream webhook request fails", async () => {
  const repository = new InMemoryWebhookRepository([buildWebhookRecord()], {})
  const dispatchService = new StubDispatchService({
    ok: false,
    response: {
      status: 500,
      body: "failed",
    },
    errorMessage: "Webhook responded with status 500.",
  })
  const service = new WebhookService(
    repository as never,
    dispatchService as never
  )

  await assert.rejects(
    () =>
      service.testWebhook({
        workspaceId: "workspace-1",
        webhookId: "webhook-1",
      }),
    /Webhook responded with status 500\./
  )
})

test("trackable webhook drafts can be tested before they are saved", async () => {
  const repository = new InMemoryWebhookRepository(
    [],
    {
      "trackable-1": { workspaceId: "workspace-1" },
    }
  )
  const dispatchService = new StubDispatchService()
  const service = new WebhookService(
    repository as never,
    dispatchService as never
  )

  const result = await service.testTrackableWebhook({
    trackableId: "trackable-1",
    enabled: true,
    provider: {
      provider: "generic",
      url: "https://example.com/hook",
      headers: {},
    },
    triggerRules: [
      {
        enabled: true,
        config: {
          type: "log_match",
          liqeQuery: "level:error",
        },
      },
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 204)
  assert.equal(dispatchService.calls.length, 1)

  const call = dispatchService.calls[0] as {
    webhook: { config: { url: string } }
    triggerRule: { config: { type: string } }
  }
  assert.equal(call.webhook.config.url, "https://example.com/hook")
  assert.equal(call.triggerRule.config.type, "log_match")
})
