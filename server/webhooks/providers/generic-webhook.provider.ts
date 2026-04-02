import type {
  WebhookDeliveryContext,
  WebhookProviderContract,
} from "@/server/webhooks/webhook.types"

export class GenericWebhookProvider implements WebhookProviderContract {
  readonly provider = "generic" as const

  buildRequest({ event, match, triggerRule, webhook }: WebhookDeliveryContext) {
    const config = webhook.config

    if (config.provider !== "generic") {
      throw new Error("GenericWebhookProvider received a non-generic webhook.")
    }

    const body = JSON.stringify({
      webhook: {
        id: webhook.id,
        name: webhook.name,
        provider: webhook.provider,
      },
      trigger: {
        id: triggerRule.id,
        type: triggerRule.config.type,
        reason: match.reason,
      },
      event: {
        kind: event.kind,
        id: event.id,
        trackableId: event.trackableId,
        workspaceId: event.workspaceId,
        occurredAt: event.occurredAt.toISOString(),
        payload: event.payload,
        metadata: event.metadata,
      },
    })

    return {
      request: {
        url: config.url,
        method: "POST" as const,
        headers: {
          "content-type": "application/json",
          ...(config.secret
            ? { "x-trackable-webhook-secret": config.secret }
            : {}),
          ...config.headers,
        },
        body,
      },
    }
  }
}
