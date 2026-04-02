import { z } from "zod"

import {
  createTrackableFormSchema,
  saveTrackableFormSchema,
} from "@/lib/project-form-builder"
import {
  usageEventContextBoundsSchema,
  usageEventContextInputSchema,
  usageEventFreshnessSchema,
  usageEventSearchInputSchema,
  usageEventSourceSnapshotSchema,
} from "@/lib/usage-event-search"
import { publicFormSubmissionSchema } from "@/lib/trackable-form-submission"
import {
  createTRPCRouter,
  getRequiredUserId,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc"
import { accessControlService } from "@/server/services/access-control.service"
import { formService } from "@/server/services/form.service"
import { shareLinkService } from "@/server/services/share-link.service"
import { apiKeyService } from "@/server/services/api-key.service"
import { sharedFormRuntimeService } from "@/server/services/shared-form-runtime.service"
import { trackableAssetService } from "@/server/trackable-assets/trackable-asset.service"
import { trackableMutationService } from "@/server/services/trackable-mutation.service"
import { trackableQueryService } from "@/server/services/trackable-query.service"
import {
  attachWebhookToTrackableInputSchema,
  saveTrackableWebhookInputSchema,
  testTrackableWebhookInputSchema,
} from "@/server/webhooks/webhook.schemas"
import { webhookService } from "@/server/webhooks/webhook.service.singleton"
import {
  getTrackableUsageEventContextBounds,
  getTrackableUsageEvents,
  getTrackableUsageSourceSnapshot,
} from "@/server/usage-tracking/usage-event-query"
import { getUsageEventPageSize } from "@/server/usage-tracking/usage-event-config"

const accessRoleSchema = z.enum(["submit", "view", "manage"])
const trackableKindSchema = z.enum(["survey", "api_ingestion"])
const apiLogRetentionDaysSchema = z.union([
  z.literal(3),
  z.literal(7),
  z.literal(30),
  z.literal(90),
  z.null(),
])

export const trackablesRouter = createTRPCRouter({
  listWebhooks: protectedProcedure
    .input(z.object({ trackableId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await accessControlService.assertTrackableAccess(
        input.trackableId,
        getRequiredUserId(ctx),
        "view"
      )

      const webhooks = await webhookService.listTrackableWebhooks(
        input.trackableId
      )

      return webhooks.map((webhook) => webhook.toRecord())
    }),

  saveWebhook: protectedProcedure
    .input(saveTrackableWebhookInputSchema)
    .mutation(async ({ ctx, input }) => {
      await accessControlService.assertTrackableAccess(
        input.trackableId,
        getRequiredUserId(ctx),
        "manage"
      )

      const webhook = await webhookService.saveTrackableWebhook(
        input,
        getRequiredUserId(ctx)
      )

      return webhook.toRecord()
    }),

  testWebhook: protectedProcedure
    .input(testTrackableWebhookInputSchema)
    .mutation(async ({ ctx, input }) => {
      await accessControlService.assertTrackableAccess(
        input.trackableId,
        getRequiredUserId(ctx),
        "manage"
      )

      return webhookService.testTrackableWebhook(input)
    }),

  attachWebhook: protectedProcedure
    .input(attachWebhookToTrackableInputSchema)
    .mutation(async ({ ctx, input }) => {
      await accessControlService.assertTrackableAccess(
        input.trackableId,
        getRequiredUserId(ctx),
        "manage"
      )

      const webhooks = await webhookService.attachWebhookToTrackable(
        input,
        getRequiredUserId(ctx)
      )

      return webhooks.map((webhook) => webhook.toRecord())
    }),

  detachWebhook: protectedProcedure
    .input(attachWebhookToTrackableInputSchema)
    .mutation(async ({ ctx, input }) => {
      await accessControlService.assertTrackableAccess(
        input.trackableId,
        getRequiredUserId(ctx),
        "manage"
      )

      const webhooks = await webhookService.detachWebhookFromTrackable(input)
      return webhooks.map((webhook) => webhook.toRecord())
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return trackableQueryService.getById(input.id, getRequiredUserId(ctx))
    }),

  listAssets: protectedProcedure
    .input(z.object({ trackableId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return trackableAssetService.listAssets(
        input.trackableId,
        getRequiredUserId(ctx)
      )
    }),

  deleteAsset: protectedProcedure
    .input(z.object({ assetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return trackableAssetService.deleteAsset(
        input.assetId,
        getRequiredUserId(ctx)
      )
    }),

  getShellById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return trackableQueryService.getShellById(
        input.id,
        getRequiredUserId(ctx)
      )
    }),

  getUsageEventTable: protectedProcedure
    .input(usageEventSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const resolvedInput = {
        ...input,
        pageSize: input.pageSize ?? getUsageEventPageSize(),
      }

      await accessControlService.assertTrackableAccess(
        resolvedInput.trackableId,
        getRequiredUserId(ctx),
        "view"
      )

      const sourceSnapshot = await getTrackableUsageSourceSnapshot(
        resolvedInput.trackableId
      )

      return getTrackableUsageEvents(resolvedInput, sourceSnapshot)
    }),

  getUsageEventContextBounds: protectedProcedure
    .input(usageEventContextInputSchema)
    .output(usageEventContextBoundsSchema)
    .query(async ({ ctx, input }) => {
      await accessControlService.assertTrackableAccess(
        input.trackableId,
        getRequiredUserId(ctx),
        "view"
      )

      return getTrackableUsageEventContextBounds(input)
    }),

  getUsageEventFreshness: protectedProcedure
    .input(
      z.object({
        trackableId: z.string().uuid(),
        sourceSnapshot: usageEventSourceSnapshotSchema,
      })
    )
    .output(usageEventFreshnessSchema)
    .query(async ({ ctx, input }) => {
      await accessControlService.assertTrackableAccess(
        input.trackableId,
        getRequiredUserId(ctx),
        "view"
      )

      const currentSnapshot = await getTrackableUsageSourceSnapshot(
        input.trackableId
      )

      return {
        hasUpdates:
          currentSnapshot.totalEventCount !==
            input.sourceSnapshot.totalEventCount ||
          currentSnapshot.latestOccurredAt !==
            input.sourceSnapshot.latestOccurredAt,
        latestOccurredAt: currentSnapshot.latestOccurredAt,
        latestEventCount: currentSnapshot.totalEventCount,
      }
    }),

  getSharedForm: publicProcedure
    .input(z.object({ token: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      const { shareLink: _, ...result } =
        await sharedFormRuntimeService.loadForViewer(
          input.token,
          ctx.auth.userId ?? null
        )
      return result
    }),

  submitSharedForm: publicProcedure
    .input(publicFormSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      return sharedFormRuntimeService.submit({
        token: input.token,
        answers: input.answers,
        responderEmail: input.responderEmail,
        metadata: input.metadata,
        userId: ctx.auth.userId ?? null,
      })
    }),

  createForm: protectedProcedure
    .input(createTrackableFormSchema)
    .mutation(async ({ ctx, input }) => {
      return formService.createForm(input.trackableId, getRequiredUserId(ctx))
    }),

  saveForm: protectedProcedure
    .input(saveTrackableFormSchema)
    .mutation(async ({ ctx, input }) => {
      return formService.saveForm(
        input.trackableId,
        getRequiredUserId(ctx),
        input.form
      )
    }),

  create: protectedProcedure
    .input(
      z.object({
        kind: trackableKindSchema,
        name: z.string().min(2, "Name must be at least 2 characters"),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return trackableMutationService.create({
        kind: input.kind,
        name: input.name,
        description: input.description,
        userId: getRequiredUserId(ctx),
      })
    }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        trackableId: z.string().uuid(),
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        allowAnonymousSubmissions: z.boolean().optional(),
        apiLogRetentionDays: apiLogRetentionDaysSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return trackableMutationService.updateSettings({
        trackableId: input.trackableId,
        userId: getRequiredUserId(ctx),
        name: input.name,
        description: input.description,
        allowAnonymousSubmissions: input.allowAnonymousSubmissions,
        apiLogRetentionDays: input.apiLogRetentionDays,
      })
    }),

  upsertEmailGrant: protectedProcedure
    .input(
      z.object({
        trackableId: z.string().uuid(),
        email: z.string().email(),
        role: accessRoleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return shareLinkService.upsertEmailGrant({
        trackableId: input.trackableId,
        userId: getRequiredUserId(ctx),
        email: input.email,
        role: input.role,
      })
    }),

  revokeAccessGrant: protectedProcedure
    .input(
      z.object({
        trackableId: z.string().uuid(),
        grantId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return shareLinkService.revokeAccessGrant({
        trackableId: input.trackableId,
        userId: getRequiredUserId(ctx),
        grantId: input.grantId,
      })
    }),

  createShareLink: protectedProcedure
    .input(
      z.object({
        trackableId: z.string().uuid(),
        role: accessRoleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return shareLinkService.createShareLink({
        trackableId: input.trackableId,
        userId: getRequiredUserId(ctx),
        role: input.role,
      })
    }),

  updateShareLink: protectedProcedure
    .input(
      z.object({
        trackableId: z.string().uuid(),
        linkId: z.string().uuid(),
        role: accessRoleSchema,
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return shareLinkService.updateShareLink({
        trackableId: input.trackableId,
        userId: getRequiredUserId(ctx),
        linkId: input.linkId,
        role: input.role,
        isActive: input.isActive,
      })
    }),

  createApiKey: protectedProcedure
    .input(
      z.object({
        trackableId: z.string().uuid(),
        name: z.string().min(2, "Name must be at least 2 characters"),
        expirationPreset: z.enum(["never", "30_days", "60_days", "90_days"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.createApiKey({
        trackableId: input.trackableId,
        userId: getRequiredUserId(ctx),
        name: input.name,
        expirationPreset: input.expirationPreset,
      })
    }),

  revokeApiKey: protectedProcedure
    .input(
      z.object({
        trackableId: z.string().uuid(),
        apiKeyId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.revokeApiKey({
        trackableId: input.trackableId,
        userId: getRequiredUserId(ctx),
        apiKeyId: input.apiKeyId,
      })
    }),
})
