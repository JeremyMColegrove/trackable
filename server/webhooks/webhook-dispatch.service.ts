import {
  getBoundedLogExcerpt,
  getLogger,
  getWebhookTargetSummary,
} from "@/lib/logger"
import type { WebhookDeliveryRepository } from "@/server/webhooks/webhook-delivery.repository"
import type { WebhookProviderRegistry } from "@/server/webhooks/webhook-provider-registry"
import type {
  WebhookDeliveryContext,
  WebhookExecutionResult,
  WebhookHttpClient,
} from "@/server/webhooks/webhook.types"

const logger = getLogger("webhook-dispatch")

export class WebhookDispatchService {
  constructor(
    private readonly providerRegistry: WebhookProviderRegistry,
    private readonly httpClient: WebhookHttpClient,
    private readonly deliveryRepository: Pick<
      WebhookDeliveryRepository,
      "createAttempt"
    >
  ) {}

  async dispatch(context: WebhookDeliveryContext): Promise<WebhookExecutionResult> {
    const provider = this.providerRegistry.get(context.webhook.provider)
    const deliveryRequest = provider.buildRequest(context)
    const target = getWebhookTargetSummary(deliveryRequest.request.url)

    try {
      const response = await this.httpClient.send(deliveryRequest.request)
      const ok = response.status >= 200 && response.status < 300
      const failureMessage = ok
        ? null
        : this.buildFailureMessage(response.status, response.body ?? "")

      await this.deliveryRepository.createAttempt({
        webhookId: context.webhook.id,
        triggerRuleId: context.triggerRule.id,
        trackableId: context.event.trackableId,
        usageEventId:
          context.event.kind === "usage_event" ? context.event.id : null,
        submissionId:
          context.event.kind === "survey_response" ? context.event.id : null,
        provider: context.webhook.provider,
        status: ok ? "success" : "failed",
        requestPayload: deliveryRequest.request,
        responsePayload: response,
        errorMessage: failureMessage,
      })

      return {
        ok,
        response,
        errorMessage: failureMessage,
        statusCode: response.status,
        failureKind: ok ? null : "downstream_error",
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown webhook delivery failure."

      logger.error(
        {
          err: error,
          webhookId: context.webhook.id,
          triggerRuleId: context.triggerRule.id,
          trackableId: context.event.trackableId,
          webhookEventId: context.event.id,
          webhookEventKind: context.event.kind,
          provider: context.webhook.provider,
          target,
          errorExcerpt: getBoundedLogExcerpt(errorMessage),
        },
        "Webhook delivery failed."
      )

      await this.deliveryRepository.createAttempt({
        webhookId: context.webhook.id,
        triggerRuleId: context.triggerRule.id,
        trackableId: context.event.trackableId,
        usageEventId:
          context.event.kind === "usage_event" ? context.event.id : null,
        submissionId:
          context.event.kind === "survey_response" ? context.event.id : null,
        provider: context.webhook.provider,
        status: "failed",
        requestPayload: deliveryRequest.request,
        responsePayload: null,
        errorMessage,
      })

      return {
        ok: false,
        response: null,
        errorMessage,
        statusCode: null,
        failureKind: "transport_error",
      }
    }
  }

  async sendTest(context: WebhookDeliveryContext): Promise<WebhookExecutionResult> {
    const provider = this.providerRegistry.get(context.webhook.provider)
    const deliveryRequest = provider.buildRequest(context)

    try {
      const response = await this.httpClient.send(deliveryRequest.request)
      const ok = response.status >= 200 && response.status < 300

      return {
        ok,
        response,
        errorMessage: ok
          ? null
          : this.buildFailureMessage(response.status, response.body ?? ""),
        statusCode: response.status,
        failureKind: ok ? null : "downstream_error",
      }
    } catch (error) {
      return {
        ok: false,
        response: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unknown webhook delivery failure.",
        statusCode: null,
        failureKind: "transport_error",
      }
    }
  }

  private buildFailureMessage(status: number, responseBody: string) {
    const excerpt = getBoundedLogExcerpt(responseBody)

    if (!excerpt) {
      return `Webhook responded with status ${status}.`
    }

    return `Webhook responded with status ${status}: ${excerpt}`
  }
}
