import type {
  WebhookDeliveryRequestPayload,
  WebhookDeliveryResponsePayload,
} from "@/db/schema/types"
import type { WebhookHttpClient } from "@/server/webhooks/webhook.types"
import { assertSafeWebhookTargetUrl } from "@/server/webhooks/webhook-url-security"

export class FetchWebhookHttpClient implements WebhookHttpClient {
  async send(
    request: WebhookDeliveryRequestPayload
  ): Promise<WebhookDeliveryResponsePayload> {
    await assertSafeWebhookTargetUrl(request.url)

    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    })

    return {
      status: response.status,
      body: await response.text(),
    }
  }
}

export const fetchWebhookHttpClient = new FetchWebhookHttpClient()
