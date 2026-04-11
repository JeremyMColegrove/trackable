import { resolveWebhookLogId } from "@/server/webhooks/webhook-log"
import type {
  WebhookDeliveryContext,
  WebhookEvent,
  WebhookProviderContract,
} from "@/server/webhooks/webhook.types"

export class MicrosoftTeamsWebhookProvider implements WebhookProviderContract {
  readonly provider = "microsoft_teams" as const

  buildRequest({ event, match, triggerRule, webhook }: WebhookDeliveryContext) {
    const config = webhook.config

    if (config.provider !== "microsoft_teams") {
      throw new Error(
        "MicrosoftTeamsWebhookProvider received a non-Teams webhook."
      )
    }

    const facts =
      event.kind === "survey_response"
        ? [
            { name: "Trackable", value: event.trackableId },
            { name: "Trigger", value: triggerRule.config.type },
            { name: "Submitter", value: event.payload.submitterLabel },
            { name: "Source", value: event.payload.source },
            { name: "Response ID", value: event.id },
            { name: "Timestamp", value: event.occurredAt.toISOString() },
          ]
        : [
            { name: "Trackable", value: event.trackableId },
            { name: "Trigger", value: triggerRule.config.type },
            { name: "Log ID", value: this.resolveLogId(event) },
            { name: "Event ID", value: event.id },
            { name: "Timestamp", value: event.occurredAt.toISOString() },
          ]

    const body = JSON.stringify({
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: `Webhook fired: ${webhook.name}`,
      title: `Webhook fired: ${webhook.name}`,
      text: match.reason,
      sections: [
        {
          facts,
        },
      ],
    })

    return {
      request: {
        url: config.url,
        method: "POST" as const,
        headers: {
          "content-type": "application/json",
        },
        body,
      },
    }
  }

  private resolveLogId(event: Extract<WebhookEvent, { kind: "usage_event" }>) {
    return resolveWebhookLogId(event)
  }
}
