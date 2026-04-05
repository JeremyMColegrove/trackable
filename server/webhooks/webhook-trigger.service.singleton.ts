import { getWebhookQueue } from "@/server/webhooks/webhook-queue.bootstrap"
import { webhookRepository } from "@/server/webhooks/webhook.repository"
import { WebhookTriggerService } from "@/server/webhooks/webhook-trigger.service"

let webhookTriggerServiceSingleton: WebhookTriggerService | null = null

function getWebhookTriggerService() {
  if (!webhookTriggerServiceSingleton) {
    webhookTriggerServiceSingleton = new WebhookTriggerService(
      webhookRepository,
      getWebhookQueue()
    )
  }

  return webhookTriggerServiceSingleton
}

export const webhookTriggerService = {
  handleUsageEventRecorded(
    event: Parameters<WebhookTriggerService["handleUsageEventRecorded"]>[0]
  ) {
    return getWebhookTriggerService().handleUsageEventRecorded(event)
  },
  handleSurveyResponseRecorded(
    event: Parameters<WebhookTriggerService["handleSurveyResponseRecorded"]>[0]
  ) {
    return getWebhookTriggerService().handleSurveyResponseRecorded(event)
  },
}
