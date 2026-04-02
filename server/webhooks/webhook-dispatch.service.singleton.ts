import { webhookDeliveryRepository } from "@/server/webhooks/webhook-delivery.repository"
import { fetchWebhookHttpClient } from "@/server/webhooks/webhook-http-client"
import { webhookProviderRegistry } from "@/server/webhooks/webhook-provider-registry"
import { WebhookDispatchService } from "@/server/webhooks/webhook-dispatch.service"

export const webhookDispatchService = new WebhookDispatchService(
  webhookProviderRegistry,
  fetchWebhookHttpClient,
  webhookDeliveryRepository
)
