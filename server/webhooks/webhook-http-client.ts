import type {
  WebhookDeliveryRequestPayload,
  WebhookDeliveryResponsePayload,
} from "@/db/schema/types"
import type { WebhookHttpClient } from "@/server/webhooks/webhook.types"

export class FetchWebhookHttpClient implements WebhookHttpClient {
  async send(
    request: WebhookDeliveryRequestPayload
  ): Promise<WebhookDeliveryResponsePayload> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    })

    return {
      status: response.status,
      body: await response.text(),
    }
  }
}

export const fetchWebhookHttpClient = new FetchWebhookHttpClient()
