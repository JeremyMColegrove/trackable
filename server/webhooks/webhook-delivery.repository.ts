import { db } from "@/db"
import { webhookDeliveryAttempts } from "@/db/schema"
import type {
  WebhookDeliveryRequestPayload,
  WebhookDeliveryResponsePayload,
} from "@/db/schema/types"

export class WebhookDeliveryRepository {
  async createAttempt(input: {
    webhookId: string
    triggerRuleId: string
    trackableId: string
    usageEventId?: string | null
    submissionId?: string | null
    provider: "discord" | "generic"
    status: "failed" | "success"
    requestPayload: WebhookDeliveryRequestPayload
    responsePayload: WebhookDeliveryResponsePayload | null
    errorMessage: string | null
  }) {
    await db.insert(webhookDeliveryAttempts).values({
      webhookId: input.webhookId,
      triggerRuleId: input.triggerRuleId,
      trackableId: input.trackableId,
      usageEventId: input.usageEventId ?? null,
      submissionId: input.submissionId ?? null,
      provider: input.provider,
      status: input.status,
      requestPayload: input.requestPayload,
      responsePayload: input.responsePayload,
      errorMessage: input.errorMessage,
      attemptedAt: new Date(),
    })
  }
}

export const webhookDeliveryRepository = new WebhookDeliveryRepository()
