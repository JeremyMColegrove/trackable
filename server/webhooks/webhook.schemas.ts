import { z } from "zod"

import { validateWebhookTargetUrl } from "@/server/webhooks/webhook-url-security"

export const genericWebhookConfigSchema = z.object({
  provider: z.literal("generic"),
  url: z.string().trim().url().superRefine((value, ctx) => {
    try {
      validateWebhookTargetUrl(value)
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error
            ? error.message
            : "Webhook target is invalid.",
      })
    }
  }),
  secret: z.string().trim().min(1).max(500).nullable().optional(),
  headers: z.record(z.string(), z.string()).default({}),
})

export const discordWebhookConfigSchema = z.object({
  provider: z.literal("discord"),
  url: z.string().trim().url().superRefine((value, ctx) => {
    try {
      validateWebhookTargetUrl(value)
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error
            ? error.message
            : "Webhook target is invalid.",
      })
    }
  }),
  username: z.string().trim().min(1).max(80).nullable().optional(),
  avatarUrl: z.url().nullable().optional(),
})

export const webhookProviderConfigSchema = z.discriminatedUnion("provider", [
  genericWebhookConfigSchema,
  discordWebhookConfigSchema,
])

export const logMatchTriggerConfigSchema = z.object({
  type: z.literal("log_match"),
  liqeQuery: z.string().trim().min(1).max(500),
})

export const logCountMatchTriggerConfigSchema = z.object({
  type: z.literal("log_count_match"),
  liqeQuery: z.string().trim().min(1).max(500),
  windowMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  matchCount: z.number().int().min(1).max(100_000),
})

export const surveyResponseReceivedTriggerConfigSchema = z.object({
  type: z.literal("survey_response_received"),
})

export const webhookTriggerConfigSchema = z.discriminatedUnion("type", [
  logMatchTriggerConfigSchema,
  logCountMatchTriggerConfigSchema,
  surveyResponseReceivedTriggerConfigSchema,
])

export const createWebhookInputSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  provider: webhookProviderConfigSchema,
  enabled: z.boolean().default(true),
  triggerRules: z
    .array(
      z.object({
        enabled: z.boolean().default(true),
        config: webhookTriggerConfigSchema,
      })
    )
    .min(1)
    .max(20),
})

export const updateWebhookInputSchema = createWebhookInputSchema.extend({
  id: z.string().uuid(),
})

export const testWebhookInputSchema = z.object({
  workspaceId: z.string().uuid(),
  webhookId: z.string().uuid(),
})

export const attachWebhookToTrackableInputSchema = z.object({
  trackableId: z.string().uuid(),
  webhookId: z.string().uuid(),
})

export type CreateWebhookInput = z.infer<typeof createWebhookInputSchema>
export type UpdateWebhookInput = z.infer<typeof updateWebhookInputSchema>
export type TestWebhookInput = z.infer<typeof testWebhookInputSchema>
export type AttachWebhookToTrackableInput = z.infer<
  typeof attachWebhookToTrackableInputSchema
>

export const saveTrackableWebhookInputSchema = z.object({
  trackableId: z.string().uuid(),
  provider: webhookProviderConfigSchema,
  enabled: z.boolean().default(true),
  triggerRules: z
    .array(
      z.object({
        enabled: z.boolean().default(true),
        config: webhookTriggerConfigSchema,
      })
    )
    .min(1)
    .max(20),
})

export type SaveTrackableWebhookInput = z.infer<
  typeof saveTrackableWebhookInputSchema
>

export const testTrackableWebhookInputSchema = saveTrackableWebhookInputSchema

export type TestTrackableWebhookInput = SaveTrackableWebhookInput
