import {
  discordWebhookConfigSchema,
  genericWebhookConfigSchema,
} from "@/server/webhooks/webhook.schemas"
import { WebhookTriggerRule } from "@/server/webhooks/webhook-trigger-rule"
import type { WorkspaceWebhookRecord } from "@/server/webhooks/webhook.types"

/**
 * Core workspace-level webhook entity.
 * This keeps provider config parsing and trigger rule construction out of services.
 */
export class WorkspaceWebhookEntity {
  constructor(private readonly record: WorkspaceWebhookRecord) {}

  get id() {
    return this.record.id
  }

  get workspaceId() {
    return this.record.workspaceId
  }

  get trackableId() {
    return "trackableId" in this.record ? this.record.trackableId : null
  }

  get name() {
    return this.record.name
  }

  get provider() {
    return this.record.provider
  }

  get enabled() {
    return this.record.enabled
  }

  get triggerRules() {
    return this.record.triggerRules
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((rule) => WebhookTriggerRule.fromRecord(rule))
  }

  get providerConfig() {
    if (this.record.provider === "discord") {
      return discordWebhookConfigSchema.parse(this.record.config)
    }

    return genericWebhookConfigSchema.parse(this.record.config)
  }

  isDeliverable() {
    return this.enabled && this.record.triggerRules.some((rule) => rule.enabled)
  }

  toRecord() {
    return this.record
  }
}
