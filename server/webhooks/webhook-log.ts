import type { WebhookUsageEvent } from "@/server/webhooks/webhook.types"

export function resolveWebhookLogId(event: WebhookUsageEvent) {
  const logId = event.metadata?.logId

  return typeof logId === "string" && logId.trim() ? logId : event.id
}
