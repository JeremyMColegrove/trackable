import { logger } from "@/lib/logger"
import { getEnabledWebhookProviders } from "@/lib/runtime-config"
import { WorkspaceWebhookEntity } from "@/server/webhooks/webhook.entity"
import type { WebhookRepository } from "@/server/webhooks/webhook.repository"
import type {
  WebhookQueueContract,
  WebhookQueueJobData,
} from "@/server/webhooks/webhook.types"

/**
 * Resolves attached webhook configurations and enqueues BullMQ jobs after a log
 * is stored. Delivery happens in a separate worker so ingestion stays fast.
 */
export class WebhookTriggerService {
  constructor(
    private readonly repository: Pick<
      WebhookRepository,
      "listTrackableWebhooks"
    >,
    private readonly queue: WebhookQueueContract
  ) {}

  async handleUsageEventRecorded(event: {
    id: string
    occurredAt: Date
    trackableId: string
    workspaceId: string
  }) {
    return this.enqueueForRecordedEvent({
      kind: "usage_event",
      ...event,
    })
  }

  async handleSurveyResponseRecorded(event: {
    id: string
    occurredAt: Date
    trackableId: string
    workspaceId: string
  }) {
    return this.enqueueForRecordedEvent({
      kind: "survey_response",
      ...event,
    })
  }

  private async enqueueForRecordedEvent(event: {
    kind: "usage_event" | "survey_response"
    id: string
    occurredAt: Date
    trackableId: string
    workspaceId: string
  }) {
    const enabledProviders = getEnabledWebhookProviders()

    if (enabledProviders === false) {
      return
    }

    const attachedWebhookRecords = await this.repository.listTrackableWebhooks(
      event.trackableId
    )
    const jobs: WebhookQueueJobData[] = []

    for (const record of attachedWebhookRecords) {
      const webhook = new WorkspaceWebhookEntity(record)

      if (!webhook.isDeliverable()) {
        continue
      }

      if (!enabledProviders.has(record.provider)) {
        continue
      }

      for (const triggerRule of record.triggerRules) {
        if (!triggerRule.enabled) {
          continue
        }

        jobs.push({
          event: {
            kind: event.kind,
            id: event.id,
            occurredAt: event.occurredAt.toISOString(),
            trackableId: event.trackableId,
            workspaceId: event.workspaceId,
          },
          webhook: webhook.toRecord(),
          triggerRule,
        })
      }
    }

    if (jobs.length === 0) {
      return
    }

    try {
      await this.queue.enqueue(jobs)
    } catch (error) {
      logger.error(
        {
          err: error,
          trackableId: event.trackableId,
          webhookEventId: event.id,
          webhookEventKind: event.kind,
        },
        "Failed to enqueue webhook jobs."
      )
    }
  }
}
