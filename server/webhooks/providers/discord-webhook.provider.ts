import { buildLocalizedUrl } from "@/lib/discovery-files"
import { resolveWebhookLogId } from "@/server/webhooks/webhook-log"
import type {
  WebhookEvent,
  WebhookDeliveryContext,
  WebhookProviderContract,
} from "@/server/webhooks/webhook.types"

export class DiscordWebhookProvider implements WebhookProviderContract {
  readonly provider = "discord" as const

  buildRequest({ event, match, triggerRule, webhook }: WebhookDeliveryContext) {
    const config = webhook.config

    if (config.provider !== "discord") {
      throw new Error("DiscordWebhookProvider received a non-discord webhook.")
    }

    const body = JSON.stringify({
      username: this.resolveUsername(config.username),
      avatar_url: config.avatarUrl ?? undefined,
      embeds: [
        event.kind === "survey_response"
          ? {
              title: `Webhook fired: ${webhook.name}`,
              description: match.reason,
              color: 0x57f287,
              timestamp: event.occurredAt.toISOString(),
              fields: [
                {
                  name: "Trackable",
                  value: event.trackableId,
                  inline: false,
                },
                {
                  name: "Trigger",
                  value: triggerRule.config.type,
                  inline: true,
                },
                {
                  name: "Submitter",
                  value: event.payload.submitterLabel,
                  inline: true,
                },
                {
                  name: "Source",
                  value: event.payload.source,
                  inline: true,
                },
                {
                  name: "Response ID",
                  value: event.id,
                  inline: true,
                },
                {
                  name: "Open Response",
                  value: this.buildSurveyResponseLink(event),
                  inline: false,
                },
              ],
            }
          : {
              title: `Webhook fired: ${webhook.name}`,
              description: match.reason,
              color: this.resolveColor(event.payload.level),
              timestamp: event.occurredAt.toISOString(),
              fields: [
                {
                  name: "Trackable",
                  value: event.trackableId,
                  inline: false,
                },
                {
                  name: "Trigger",
                  value: triggerRule.config.type,
                  inline: true,
                },
                {
                  name: "Filter",
                  value: this.truncateInlineCode(
                    "liqeQuery" in triggerRule.config
                      ? triggerRule.config.liqeQuery
                      : "*"
                  ),
                  inline: false,
                },
                {
                  name: "Log ID",
                  value: this.resolveLogId(event),
                  inline: true,
                },
                {
                  name: "Open Log",
                  value: this.buildLogLink(event),
                  inline: false,
                },
              ],
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

  private resolveColor(level: unknown) {
    switch (level) {
      case "error":
        return 0xed4245
      case "warn":
        return 0xfee75c
      case "info":
        return 0x5865f2
      default:
        return 0x57f287
    }
  }

  private resolveUsername(username: string | null | undefined) {
    if (!username) {
      return undefined
    }

    const normalized = username.trim()

    if (!normalized) {
      return undefined
    }

    if (normalized.toLowerCase().includes("discord")) {
      return undefined
    }

    return normalized
  }

  private resolveLogId(event: Extract<WebhookEvent, { kind: "usage_event" }>) {
    return resolveWebhookLogId(event)
  }

  private buildLogLink(event: Extract<WebhookEvent, { kind: "usage_event" }>) {
    const logId = this.resolveLogId(event)
    const url = buildLocalizedUrl(`/dashboard/trackables/${event.trackableId}`)
    url.searchParams.set("q", `metadata.logId:"${logId}"`)

    return `[Open filtered logs](${url.toString()})`
  }

  private buildSurveyResponseLink(
    event: Extract<WebhookEvent, { kind: "survey_response" }>
  ) {
    const url = buildLocalizedUrl(`/dashboard/trackables/${event.trackableId}`)
    url.searchParams.set("q", event.id)

    return `[Open filtered response](${url.toString()})`
  }

  private truncateInlineCode(value: string) {
    const maxLength = 900
    const normalized =
      value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
    return `\`${normalized.replaceAll("`", "'")}\``
  }
}
