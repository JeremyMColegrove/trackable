import type { Job } from "bullmq"

import { getLogger } from "@/lib/logger"
import { resolveWebhookLogId } from "@/server/webhooks/webhook-log"
import { WebhookTriggerRule } from "@/server/webhooks/webhook-trigger-rule"
import type { WebhookDispatchService } from "@/server/webhooks/webhook-dispatch.service"
import type { WebhookRepository } from "@/server/webhooks/webhook.repository"
import type { WebhookQueueJobData } from "@/server/webhooks/webhook.types"

type WebhookProcessorRepository = Pick<
  WebhookRepository,
  "countMatchingEvents" | "getSurveyResponseEventById" | "getUsageEventById"
>

type WebhookProcessorDispatchService = Pick<WebhookDispatchService, "dispatch">

const logger = getLogger("webhook-processor")

export class WebhookProcessor {
  constructor(
    private readonly repository: WebhookProcessorRepository,
    private readonly dispatchService: WebhookProcessorDispatchService
  ) {}

  async process(job: Pick<Job<WebhookQueueJobData>, "data" | "id" | "name">) {
    const event =
      job.data.event.kind === "survey_response"
        ? await this.repository.getSurveyResponseEventById(job.data.event.id)
        : await this.repository.getUsageEventById(job.data.event.id)

    if (!event) {
      logger.warn(
        {
          eventId: job.data.event.id,
          eventKind: job.data.event.kind,
          jobId: job.id ?? null,
          jobName: job.name,
        },
        "Skipping webhook job because the webhook event no longer exists."
      )
      return {
        delivered: false,
        reason: "event_not_found" as const,
      }
    }

    const triggerRule = WebhookTriggerRule.fromRecord(job.data.triggerRule)
    const match = await triggerRule.matches(event, {
      eventRepository: this.repository,
    })

    if (!match) {
      return {
        delivered: false,
        reason: "no_match" as const,
      }
    }

    const result = await this.dispatchService.dispatch({
      webhook: job.data.webhook,
      triggerRule: job.data.triggerRule,
      event,
      match,
    })

    return {
      delivered: result.ok,
      eventId: event.id,
      ...(event.kind === "usage_event"
        ? {
            logId: resolveWebhookLogId(event),
          }
        : {
            submissionId: event.id,
          }),
      statusCode: result.statusCode,
      failureKind: result.failureKind,
      reason: result.ok ? ("delivered" as const) : ("delivery_failed" as const),
    }
  }
}
