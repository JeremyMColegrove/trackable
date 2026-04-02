import { getWebhookQueue } from "@/server/webhooks/webhook-queue.bootstrap"
import { webhookRepository } from "@/server/webhooks/webhook.repository"
import { WebhookTriggerService } from "@/server/webhooks/webhook-trigger.service"

export const webhookTriggerService = new WebhookTriggerService(
  webhookRepository,
  getWebhookQueue()
)
