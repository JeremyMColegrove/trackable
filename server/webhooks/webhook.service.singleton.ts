import { webhookDispatchService } from "@/server/webhooks/webhook-dispatch.service.singleton"
import { webhookRepository } from "@/server/webhooks/webhook.repository"
import { WebhookService } from "@/server/webhooks/webhook.service"

export const webhookService = new WebhookService(
  webhookRepository,
  webhookDispatchService
)
