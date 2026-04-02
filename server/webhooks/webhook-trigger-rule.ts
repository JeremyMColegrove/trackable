import type {
  LogCountMatchTriggerConfig,
  LogMatchTriggerConfig,
  SurveyResponseReceivedTriggerConfig,
} from "@/db/schema/types"
import { resolveWebhookLogId } from "@/server/webhooks/webhook-log"
import { webhookTriggerSearchBuilder } from "@/server/webhooks/webhook-trigger-search"
import type {
  WebhookEvent,
  WebhookEventRepositoryContract,
  WebhookTriggerMatch,
  WebhookTriggerRuleRecord,
} from "@/server/webhooks/webhook.types"

interface TriggerEvaluationDependencies {
  eventRepository: WebhookEventRepositoryContract
}

export abstract class WebhookTriggerRule {
  constructor(protected readonly record: WebhookTriggerRuleRecord) {}

  get id() {
    return this.record.id
  }

  get enabled() {
    return this.record.enabled
  }

  abstract matches(
    event: WebhookEvent,
    dependencies: TriggerEvaluationDependencies
  ): Promise<WebhookTriggerMatch | null>

  static fromRecord(record: WebhookTriggerRuleRecord) {
    switch (record.config.type) {
      case "log_match":
        return new LogMatchWebhookTriggerRule(record)
      case "log_count_match":
        return new LogCountWebhookTriggerRule(record)
      case "survey_response_received":
        return new SurveyResponseReceivedWebhookTriggerRule(record)
    }
  }
}

export class LogMatchWebhookTriggerRule extends WebhookTriggerRule {
  private get config() {
    return this.record.config as LogMatchTriggerConfig
  }

  async matches(
    event: WebhookEvent,
    dependencies: TriggerEvaluationDependencies
  ) {
    if (!this.enabled) {
      return null
    }

    if (event.kind !== "usage_event") {
      return null
    }

    const matchedCount = await dependencies.eventRepository.countMatchingEvents(
      {
        trackableId: event.trackableId,
        filterQuery: webhookTriggerSearchBuilder.buildLogMatchQuery({
          eventId: resolveWebhookLogId(event),
          liqeQuery: this.config.liqeQuery,
        }),
      }
    )

    if (matchedCount === 0) {
      return null
    }

    return {
      ruleId: this.id,
      reason: `Log matched filter: ${this.config.liqeQuery}`,
    }
  }
}

export class LogCountWebhookTriggerRule extends WebhookTriggerRule {
  private get config() {
    return this.record.config as LogCountMatchTriggerConfig
  }

  async matches(
    event: WebhookEvent,
    dependencies: TriggerEvaluationDependencies
  ) {
    if (!this.enabled) {
      return null
    }

    if (event.kind !== "usage_event") {
      return null
    }

    const occurredAfter = new Date(
      event.occurredAt.getTime() - this.config.windowMinutes * 60 * 1000
    )

    const matchedCount = await dependencies.eventRepository.countMatchingEvents(
      {
        trackableId: event.trackableId,
        filterQuery: webhookTriggerSearchBuilder.buildLogCountQuery({
          liqeQuery: this.config.liqeQuery,
        }),
        occurredAfter,
      }
    )

    if (matchedCount < this.config.matchCount) {
      return null
    }

    return {
      ruleId: this.id,
      reason: `${matchedCount} matching logs found in the last ${this.config.windowMinutes} minutes`,
    }
  }
}

export class SurveyResponseReceivedWebhookTriggerRule extends WebhookTriggerRule {
  private get config() {
    return this.record.config as SurveyResponseReceivedTriggerConfig
  }

  async matches(
    event: WebhookEvent,
    _dependencies: TriggerEvaluationDependencies
  ) {
    if (!this.enabled) {
      return null
    }

    if (event.kind !== "survey_response") {
      return null
    }

    return {
      ruleId: this.id,
      reason:
        this.config.type === "survey_response_received"
          ? "Survey response received."
          : "Survey response received.",
    }
  }
}
