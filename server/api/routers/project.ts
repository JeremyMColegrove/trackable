import { TRPCError } from "@trpc/server"
import { z } from "zod"

import {
  createTrackableFormSchema,
  saveTrackableFormSchema,
} from "@/lib/project-form-builder"
import {
  usageEventFreshnessSchema,
  usageEventSearchInputSchema,
  usageEventSourceSnapshotSchema,
} from "@/lib/usage-event-search"
import { publicFormSubmissionSchema } from "@/lib/trackable-form-submission"
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc"
import { accessControlService } from "@/server/services/access-control.service"
import { projectService } from "@/server/services/project.service"
import { formService } from "@/server/services/form.service"
import { formSubmissionService } from "@/server/services/form-submission.service"
import { shareLinkService } from "@/server/services/share-link.service"
import { apiKeyService } from "@/server/services/api-key.service"
import {
  getTrackableUsageEvents,
  getTrackableUsageSourceSnapshot,
} from "@/server/usage-tracking/usage-event-query"

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
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return projectService.getById(input.id, userId)
    }),

  getUsageEventTable: protectedProcedure
    .input(usageEventSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      await accessControlService.assertProjectAccess(
        input.trackableId,
        userId,
        "view"
      )

      const sourceSnapshot = await getTrackableUsageSourceSnapshot(input.trackableId)

      return getTrackableUsageEvents(input, sourceSnapshot)
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      await accessControlService.assertProjectAccess(
        input.trackableId,
        userId,
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
      const { shareLink: _, ...result } = await shareLinkService.getSharedForm(
        input.token,
        ctx.auth.userId ?? null
      )
      return result
    }),

  submitSharedForm: publicProcedure
    .input(publicFormSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      return formSubmissionService.submitSharedForm({
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return formService.createForm(input.trackableId, userId)
    }),

  saveForm: protectedProcedure
    .input(saveTrackableFormSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return formService.saveForm(input.trackableId, userId, input.form)
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return projectService.create({
        kind: input.kind,
        name: input.name,
        description: input.description,
        userId,
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return projectService.updateSettings({
        trackableId: input.trackableId,
        userId,
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return shareLinkService.upsertEmailGrant({
        trackableId: input.trackableId,
        userId,
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return shareLinkService.revokeAccessGrant({
        trackableId: input.trackableId,
        userId,
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return shareLinkService.createShareLink({
        trackableId: input.trackableId,
        userId,
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return shareLinkService.updateShareLink({
        trackableId: input.trackableId,
        userId,
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return apiKeyService.createApiKey({
        trackableId: input.trackableId,
        userId,
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
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return apiKeyService.revokeApiKey({
        trackableId: input.trackableId,
        userId,
        apiKeyId: input.apiKeyId,
      })
    }),
})
