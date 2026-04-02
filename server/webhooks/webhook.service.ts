import { TRPCError } from "@trpc/server"

import { WorkspaceWebhookEntity } from "@/server/webhooks/webhook.entity"
import type { WebhookDispatchService } from "@/server/webhooks/webhook-dispatch.service"
import type {
  AttachWebhookToTrackableInput,
  CreateWebhookInput,
  TestWebhookInput,
  UpdateWebhookInput,
  SaveTrackableWebhookInput,
  TestTrackableWebhookInput,
} from "@/server/webhooks/webhook.schemas"
import type { WebhookRepository } from "@/server/webhooks/webhook.repository"
import type {
  WebhookTriggerRuleRecord,
  WorkspaceWebhookRecord,
} from "@/server/webhooks/webhook.types"

export class WebhookService {
  constructor(
    private readonly repository: Pick<
      WebhookRepository,
      | "attachWebhookToTrackable"
      | "createWebhook"
      | "deleteWebhook"
      | "detachWebhookFromTrackable"
      | "getTrackable"
      | "getWorkspaceWebhookById"
      | "listTrackableWebhooks"
      | "listWorkspaceWebhooks"
      | "updateWebhook"
    >,
    private readonly dispatchService: Pick<WebhookDispatchService, "sendTest">
  ) {}

  async listWorkspaceWebhooks(workspaceId: string) {
    const webhooks = await this.repository.listWorkspaceWebhooks(workspaceId)
    return webhooks.map((record) => new WorkspaceWebhookEntity(record))
  }

  async createWebhook(input: CreateWebhookInput, userId: string) {
    const webhookId = await this.repository.createWebhook({
      workspaceId: input.workspaceId,
      userId,
      name: input.name,
      provider: input.provider,
      enabled: input.enabled,
      triggerRules: input.triggerRules,
    })

    return this.requireWorkspaceWebhook(webhookId)
  }

  async updateWebhook(input: UpdateWebhookInput) {
    await this.requireWorkspaceWebhook(input.id)

    await this.repository.updateWebhook({
      webhookId: input.id,
      name: input.name,
      provider: input.provider,
      enabled: input.enabled,
      triggerRules: input.triggerRules,
    })

    return this.requireWorkspaceWebhook(input.id)
  }

  async deleteWebhook(webhookId: string) {
    await this.requireWorkspaceWebhook(webhookId)
    await this.repository.deleteWebhook(webhookId)
    return { ok: true }
  }

  async testWebhook(input: TestWebhookInput) {
    const webhook = await this.requireWorkspaceWebhook(input.webhookId)

    if (webhook.workspaceId !== input.workspaceId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Webhook does not belong to this workspace.",
      })
    }

    const triggerRule =
      webhook.toRecord().triggerRules.find((rule) => rule.enabled) ??
      webhook.toRecord().triggerRules[0]

    if (!triggerRule) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Webhook must have at least one trigger rule to send a test.",
      })
    }

    const result = await this.sendTestDelivery({
      webhook: webhook.toRecord(),
      triggerRule,
    })

    if (!result.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          result.errorMessage ??
          (result.response?.status
            ? `Webhook responded with status ${result.response.status}.`
            : "Webhook test delivery failed."),
      })
    }

    return {
      ok: true,
      status: result.response?.status ?? null,
      errorMessage: null,
    }
  }

  async listTrackableWebhooks(trackableId: string) {
    const webhooks = await this.repository.listTrackableWebhooks(trackableId)
    return webhooks.map((record) => new WorkspaceWebhookEntity(record))
  }

  async attachWebhookToTrackable(input: AttachWebhookToTrackableInput, userId: string) {
    const [trackable, webhook] = await Promise.all([
      this.repository.getTrackable(input.trackableId),
      this.requireWorkspaceWebhook(input.webhookId),
    ])

    if (!trackable) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    if (trackable.workspaceId !== webhook.workspaceId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Trackables can only attach webhooks from the same workspace.",
      })
    }

    this.assertTriggerRulesCompatible(trackable.kind, webhook.toRecord().triggerRules)

    await this.repository.attachWebhookToTrackable({
      trackableId: input.trackableId,
      webhookId: input.webhookId,
      userId,
    })

    return this.listTrackableWebhooks(input.trackableId)
  }

  async detachWebhookFromTrackable(input: AttachWebhookToTrackableInput) {
    await this.repository.detachWebhookFromTrackable(input)
    return this.listTrackableWebhooks(input.trackableId)
  }

  async saveTrackableWebhook(input: SaveTrackableWebhookInput, userId: string) {
    const trackable = await this.repository.getTrackable(
      input.trackableId
    )

    if (!trackable) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    this.assertTriggerRulesCompatible(trackable.kind, input.triggerRules)

    const existingWebhooks = await this.listTrackableWebhooks(input.trackableId)
    const existingWebhook = existingWebhooks.find(
      (w) => w.provider === input.provider.provider
    )

    if (existingWebhook) {
      await this.repository.updateWebhook({
        webhookId: existingWebhook.id,
        name: `Trackable Webhook (${input.provider.provider})`,
        provider: input.provider,
        enabled: input.enabled,
        triggerRules: input.triggerRules,
      })
      return this.requireWorkspaceWebhook(existingWebhook.id)
    }

    const webhookId = await this.repository.createWebhook({
      workspaceId: trackable.workspaceId,
      userId,
      name: `Trackable Webhook (${input.provider.provider})`,
      provider: input.provider,
      enabled: input.enabled,
      triggerRules: input.triggerRules,
    })

    await this.repository.attachWebhookToTrackable({
      trackableId: input.trackableId,
      webhookId,
      userId,
    })

    return this.requireWorkspaceWebhook(webhookId)
  }

  async testTrackableWebhook(input: TestTrackableWebhookInput) {
    const trackable = await this.repository.getTrackable(input.trackableId)

    if (!trackable) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    this.assertTriggerRulesCompatible(trackable.kind, input.triggerRules)

    const triggerRule =
      input.triggerRules.find((rule) => rule.enabled) ?? input.triggerRules[0]

    if (!triggerRule) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Webhook must have at least one trigger rule to send a test.",
      })
    }

    const result = await this.sendTestDelivery({
      webhook: {
        id: "draft-trackable-webhook",
        workspaceId: trackable.workspaceId,
        name: `Trackable Webhook (${input.provider.provider})`,
        provider: input.provider.provider,
        config: input.provider,
        enabled: input.enabled,
        triggerRules: input.triggerRules.map((rule, index) => ({
          id: `draft-trigger-rule-${index + 1}`,
          webhookId: "draft-trackable-webhook",
          enabled: rule.enabled,
          position: index,
          config: rule.config,
        })),
      },
      triggerRule,
    })

    if (!result.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          result.errorMessage ??
          (result.response?.status
            ? `Webhook responded with status ${result.response.status}.`
            : "Webhook test delivery failed."),
      })
    }

    return {
      ok: true,
      status: result.response?.status ?? null,
      errorMessage: null,
    }
  }

  private async requireWorkspaceWebhook(webhookId: string) {
    const webhook = await this.repository.getWorkspaceWebhookById(webhookId)

    if (!webhook) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Webhook not found.",
      })
    }

    return new WorkspaceWebhookEntity(webhook)
  }

  private assertTriggerRulesCompatible(
    trackableKind: "survey" | "api_ingestion",
    triggerRules: Array<{
      enabled: boolean
      config: WebhookTriggerRuleRecord["config"]
    }>
  ) {
    if (trackableKind === "survey") {
      if (triggerRules.length !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Survey webhooks support exactly one trigger rule.",
        })
      }

      if (triggerRules[0]?.config.type !== "survey_response_received") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Survey webhooks can only trigger on received responses.",
        })
      }

      return
    }

    const hasSurveyTrigger = triggerRules.some(
      (triggerRule) => triggerRule.config.type === "survey_response_received"
    )

    if (hasSurveyTrigger) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Log webhooks cannot use survey response triggers.",
      })
    }
  }

  private async sendTestDelivery(input: {
    webhook: WorkspaceWebhookRecord
    triggerRule: WebhookTriggerRuleRecord
  }) {
    const occurredAt = new Date()

    return this.dispatchService.sendTest({
      webhook: input.webhook,
      triggerRule: input.triggerRule,
      event:
        input.triggerRule.config.type === "survey_response_received"
          ? {
              kind: "survey_response" as const,
              id: "test-survey-response",
              trackableId:
                "trackableId" in input.webhook
                  ? String(input.webhook.trackableId)
                  : "test-trackable",
              workspaceId: input.webhook.workspaceId,
              occurredAt,
              payload: {
                source: "public_link",
                submitterLabel: "Test responder",
                submissionSnapshot: {
                  form: {
                    id: "test-form",
                    version: 1,
                    title: "Test survey",
                    description: null,
                    status: "published",
                    submitLabel: "Submit",
                    successMessage: "Thanks for your response.",
                    fields: [
                      {
                        id: "field-1",
                        key: "feedback",
                        kind: "notes",
                        label: "Feedback",
                        description: null,
                        required: false,
                        position: 0,
                        config: {
                          kind: "notes",
                        },
                      },
                    ],
                  },
                  answers: [
                    {
                      fieldId: "field-1",
                      fieldKey: "feedback",
                      fieldKind: "notes",
                      fieldLabel: "Feedback",
                      value: {
                        kind: "notes",
                        value: "Manual webhook test delivery.",
                      },
                    },
                  ],
                },
              },
              metadata: {
                locale: "en",
              },
            }
          : {
              kind: "usage_event" as const,
              id: "test-event",
              trackableId:
                "trackableId" in input.webhook
                  ? String(input.webhook.trackableId)
                  : "test-trackable",
              workspaceId: input.webhook.workspaceId,
              occurredAt,
              payload: {
                level: "info",
                event: "webhook.test",
                message: "Manual webhook test delivery.",
              },
              metadata: {
                source: "manual_test",
              },
            },
      match: {
        ruleId: input.triggerRule.id,
        reason: "Manual test delivery.",
      },
    })
  }
}
