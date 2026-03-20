import { TRPCError } from "@trpc/server"
import { and, count, desc, eq, max } from "drizzle-orm"
import { randomBytes } from "node:crypto"
import { z } from "zod"

import { db } from "@/db"
import {
  apiKeys,
  trackableAccessGrants,
  trackableFormAnswers,
  trackableApiUsageEvents,
  trackableFormFields,
  trackableForms,
  trackableFormSubmissions,
  trackableItems,
  trackableShareLinks,
} from "@/db/schema"
import {
  createTrackableFormSchema,
  normalizeEditableForm,
  saveTrackableFormSchema,
} from "@/lib/project-form-builder"
import {
  usageEventFreshnessSchema,
  usageEventSearchInputSchema,
  usageEventSourceSnapshotSchema,
} from "@/lib/usage-event-search"
import {
  buildSubmissionSnapshot,
  publicFormSubmissionSchema,
  requiresResponderEmail,
} from "@/lib/trackable-form-submission"
import {
  getActiveShareLink,
  getShareLinkByToken,
  requiresAuthenticatedSharedFormAccess,
} from "@/lib/trackable-share-links"
import { hasAuthenticatedSharedFormSubmission } from "@/lib/shared-form-submissions"
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc"
import {
  buildApiKeySecret,
  hashApiKey,
  resolveApiKeyExpiration,
} from "@/server/api-keys"
import { assertProjectAccess } from "@/server/project-access"
import { resolveActiveWorkspace } from "@/server/workspaces"
import {
  getTrackableUsageAggregateFields,
  getTrackableUsageEvents,
  getTrackableUsageSourceSnapshot,
} from "@/server/usage-tracking/usage-event-query"
import { UsageEventTableProcessor } from "@/server/usage-tracking/usage-event-table-processor"
import type { TrackableKind } from "@/db/schema/types"

const accessRoleSchema = z.enum(["submit", "view", "manage"])
const trackableKindSchema = z.enum(["survey", "api_ingestion"])
const apiLogRetentionDaysSchema = z.union([
  z.literal(3),
  z.literal(7),
  z.literal(30),
  z.literal(90),
  z.null(),
])

// Helper to create a somewhat unique slug
function generateSlug(name: string) {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")

  if (!baseSlug) {
    return `trackable-${Math.random().toString(36).substring(2, 8)}`
  }

  const randomSuffix = Math.random().toString(36).substring(2, 6)
  return `${baseSlug}-${randomSuffix}`
}

function createShareToken() {
  return randomBytes(18).toString("base64url")
}

function assertTrackableKind(
  kind: TrackableKind,
  expected: TrackableKind,
  message: string
) {
  if (kind !== expected) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message,
    })
  }
}

export const trackablesRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      await assertProjectAccess(input.id, userId, "view")

      const project = await db.query.trackableItems.findFirst({
        where: eq(trackableItems.id, input.id),
        with: {
          activeForm: {
            with: {
              fields: true,
            },
          },
          accessGrants: {
            orderBy: (table, { desc }) => [desc(table.createdAt)],
            with: {
              subjectUser: {
                columns: {
                  displayName: true,
                  primaryEmail: true,
                },
              },
            },
          },
          shareLinks: {
            orderBy: (table, { desc }) => [desc(table.createdAt)],
          },
        },
      })

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trackable not found.",
        })
      }

      const [submissions, ownedApiKeys, usageCountsByKey] = await Promise.all([
        db.query.trackableFormSubmissions.findMany({
          where: eq(trackableFormSubmissions.trackableId, project.id),
          orderBy: [desc(trackableFormSubmissions.createdAt)],
          limit: 25,
          with: {
            submittedByUser: {
              columns: {
                displayName: true,
              },
            },
          },
        }),
        db.query.apiKeys.findMany({
          where: eq(apiKeys.projectId, project.id),
          orderBy: [desc(apiKeys.createdAt)],
        }),
        db
          .select({
            apiKeyId: trackableApiUsageEvents.apiKeyId,
            usageCount: count(trackableApiUsageEvents.id),
            lastOccurredAt: max(trackableApiUsageEvents.occurredAt),
          })
          .from(trackableApiUsageEvents)
          .where(eq(trackableApiUsageEvents.trackableId, project.id))
          .groupBy(trackableApiUsageEvents.apiKeyId),
      ])

      const usageByKey = new Map(
        usageCountsByKey.map((entry) => [
          entry.apiKeyId,
          {
            usageCount: Number(entry.usageCount) || 0,
            lastOccurredAt: entry.lastOccurredAt?.toISOString() ?? null,
          },
        ])
      )

      return {
        id: project.id,
        kind: project.kind,
        name: project.name,
        description: project.description,
        settings: project.settings,
        createdAt: project.createdAt.toISOString(),
        submissionCount: project.submissionCount,
        apiUsageCount: project.apiUsageCount,
        lastSubmissionAt: project.lastSubmissionAt?.toISOString() ?? null,
        lastApiUsageAt: project.lastApiUsageAt?.toISOString() ?? null,
        activeForm: project.activeForm
          ? {
              id: project.activeForm.id,
              version: project.activeForm.version,
              title: project.activeForm.title,
              description: project.activeForm.description,
              status: project.activeForm.status,
              submitLabel: project.activeForm.submitLabel,
              successMessage: project.activeForm.successMessage,
              fields: [...project.activeForm.fields].sort(
                (left, right) => left.position - right.position
              ),
            }
          : null,
        recentSubmissions: submissions.map((submission) => ({
          id: submission.id,
          createdAt: submission.createdAt.toISOString(),
          source: submission.source,
          submitterLabel:
            submission.submittedByUser?.displayName ??
            submission.submittedEmail ??
            "Anonymous",
          metadata: submission.metadata,
          submissionSnapshot: submission.submissionSnapshot,
        })),
        apiKeys: ownedApiKeys.map((key) => {
          const trackableUsage = usageByKey.get(key.id)

          return {
            id: key.id,
            name: key.name,
            maskedKey: `${key.keyPrefix}...${key.lastFour}`,
            status: key.status,
            expiresAt: key.expiresAt?.toISOString() ?? null,
            trackableUsageCount: trackableUsage?.usageCount ?? 0,
            lastUsedAt:
              trackableUsage?.lastOccurredAt ??
              key.lastUsedAt?.toISOString() ??
              null,
          }
        }),
        shareSettings: {
          accessGrants: project.accessGrants.map((grant) => ({
            id: grant.id,
            subjectType: grant.subjectType,
            subjectLabel:
              grant.subjectUser?.displayName ??
              grant.subjectUser?.primaryEmail ??
              grant.subjectEmail ??
              "Unknown recipient",
            subjectEmail:
              grant.subjectUser?.primaryEmail ?? grant.subjectEmail ?? null,
            role: grant.role,
            acceptedAt: grant.acceptedAt?.toISOString() ?? null,
            revokedAt: grant.revokedAt?.toISOString() ?? null,
            createdAt: grant.createdAt.toISOString(),
          })),
          shareLinks: project.shareLinks.map((link) => ({
            id: link.id,
            token: link.token,
            role: link.role,
            createdAt: link.createdAt.toISOString(),
            expiresAt: link.expiresAt?.toISOString() ?? null,
            revokedAt: link.revokedAt?.toISOString() ?? null,
            lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
            usageCount: link.usageCount,
          })),
        },
      }
    }),
  getUsageEventTable: protectedProcedure
    .input(usageEventSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      await assertProjectAccess(input.trackableId, userId, "view")

      const [events, sourceSnapshot, availableAggregateFields] =
        await Promise.all([
          getTrackableUsageEvents(input),
          getTrackableUsageSourceSnapshot(input.trackableId),
          getTrackableUsageAggregateFields(input.trackableId),
        ])

      const tableResult = new UsageEventTableProcessor(
        events.map((event) => ({
          id: event.id,
          occurredAt: event.occurredAt,
          payload: event.payload,
          metadata: event.metadata,
          apiKey: {
            id: event.apiKey.id,
            name: event.apiKey.name,
            maskedKey: `${event.apiKey.keyPrefix}...${event.apiKey.lastFour}`,
          },
        })),
        input,
        sourceSnapshot
      ).process()

      return {
        ...tableResult,
        availableAggregateFields,
      }
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

      await assertProjectAccess(input.trackableId, userId, "view")

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
    .input(
      z.object({
        token: z.string().trim().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const shareLink = await getActiveShareLink(input.token)

      if (!shareLink) {
        const existingShareLink = await getShareLinkByToken(input.token)

        if (existingShareLink?.revokedAt) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This shared form link is no longer active.",
          })
        }

        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This shared form could not be found.",
        })
      }

      const form = shareLink.trackable.activeForm
      const settings = shareLink.trackable.settings ?? null

      assertTrackableKind(
        shareLink.trackable.kind,
        "survey",
        "This shared form is not available for this trackable."
      )

      if (!form || form.status === "archived") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This shared form is not accepting responses right now.",
        })
      }

      if (form.fields.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This shared form does not contain any fields yet.",
        })
      }

      const requiresAuthentication =
        requiresAuthenticatedSharedFormAccess(settings)

      return {
        trackable: {
          id: shareLink.trackable.id,
          name: shareLink.trackable.name,
          description: shareLink.trackable.description,
          creatorName: shareLink.trackable.workspace.name,
        },
        form: {
          id: form.id,
          version: form.version,
          title: form.title,
          description: form.description,
          status: form.status,
          submitLabel: form.submitLabel,
          successMessage: form.successMessage,
          fields: [...form.fields].sort(
            (left, right) => left.position - right.position
          ),
        },
        settings: {
          allowAnonymousSubmissions:
            settings?.allowAnonymousSubmissions ?? true,
          collectResponderEmail: settings?.collectResponderEmail ?? false,
          requiresAuthentication,
        },
        viewer: {
          isAuthenticated: Boolean(ctx.auth.userId),
          hasSubmitted:
            ctx.auth.userId == null
              ? false
              : await hasAuthenticatedSharedFormSubmission({
                  shareLinkId: shareLink.id,
                  userId: ctx.auth.userId,
                }),
        },
      }
    }),
  submitSharedForm: publicProcedure
    .input(publicFormSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const shareLink = await getActiveShareLink(input.token)

      if (!shareLink) {
        const existingShareLink = await getShareLinkByToken(input.token)

        if (existingShareLink?.revokedAt) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This shared form link is no longer active.",
          })
        }

        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This shared form could not be found.",
        })
      }

      const form = shareLink.trackable.activeForm
      const settings = shareLink.trackable.settings ?? null

      assertTrackableKind(
        shareLink.trackable.kind,
        "survey",
        "This shared form is not available for this trackable."
      )

      if (!form || form.status === "archived") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This shared form is not accepting responses right now.",
        })
      }

      if (form.fields.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This shared form does not contain any fields yet.",
        })
      }

      if (requiresAuthenticatedSharedFormAccess(settings) && !ctx.auth.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be signed in to submit this form.",
        })
      }

      if (
        ctx.auth.userId &&
        (await hasAuthenticatedSharedFormSubmission({
          shareLinkId: shareLink.id,
          userId: ctx.auth.userId,
        }))
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You already submitted this form.",
        })
      }

      const shouldCollectEmail = requiresResponderEmail(settings)
      const responderEmail = input.responderEmail?.trim().toLowerCase()

      if (shouldCollectEmail && !responderEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Responder email is required for this form configuration.",
        })
      }

      let submissionData: ReturnType<typeof buildSubmissionSnapshot>

      try {
        submissionData = buildSubmissionSnapshot(
          {
            id: form.id,
            version: form.version,
            title: form.title,
            description: form.description,
            status: form.status,
            submitLabel: form.submitLabel,
            successMessage: form.successMessage,
            fields: [...form.fields].sort(
              (left, right) => left.position - right.position
            ),
          },
          input.answers
        )
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Unable to validate form answers.",
        })
      }

      const [createdSubmission] = await db.transaction(async (tx) => {
        const [submission] = await tx
          .insert(trackableFormSubmissions)
          .values({
            trackableId: shareLink.trackableId,
            formId: form.id,
            shareLinkId: shareLink.id,
            submittedByUserId: ctx.auth.userId ?? null,
            submittedEmail: responderEmail ?? null,
            source: "public_link",
            submissionSnapshot: submissionData.snapshot,
            metadata: {
              locale: input.metadata?.locale,
              userAgent: input.metadata?.userAgent,
              referrer: input.metadata?.referrer,
            },
          })
          .returning({
            id: trackableFormSubmissions.id,
            createdAt: trackableFormSubmissions.createdAt,
          })

        if (submissionData.answers.length > 0) {
          await tx.insert(trackableFormAnswers).values(
            submissionData.answers.map((answer) => ({
              submissionId: submission.id,
              fieldId: answer.fieldId,
              value: answer.value,
            }))
          )
        }

        await tx
          .update(trackableItems)
          .set({
            submissionCount: shareLink.trackable.submissionCount + 1,
            lastSubmissionAt: submission.createdAt,
            updatedAt: new Date(),
          })
          .where(eq(trackableItems.id, shareLink.trackableId))

        await tx
          .update(trackableShareLinks)
          .set({
            usageCount: shareLink.usageCount + 1,
            lastUsedAt: submission.createdAt,
            updatedAt: new Date(),
          })
          .where(eq(trackableShareLinks.id, shareLink.id))

        return [submission]
      })

      return {
        id: createdSubmission.id,
        createdAt: createdSubmission.createdAt.toISOString(),
        successMessage: form.successMessage ?? "Thanks for your response.",
      }
    }),
  createForm: protectedProcedure
    .input(createTrackableFormSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const trackable = await assertProjectAccess(
        input.trackableId,
        userId,
        "manage"
      )

      const trackableRecord = await db.query.trackableItems.findFirst({
        where: eq(trackableItems.id, trackable.id),
        columns: {
          id: true,
          kind: true,
          name: true,
          description: true,
        },
      })

      if (!trackableRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trackable not found.",
        })
      }

      assertTrackableKind(
        trackableRecord.kind,
        "survey",
        "Only survey trackables can build forms."
      )

      const form = await db.transaction(async (tx) => {
        const [versionResult] = await tx
          .select({
            maxVersion: max(trackableForms.version),
          })
          .from(trackableForms)
          .where(eq(trackableForms.trackableId, trackableRecord.id))

        const nextVersion = (versionResult?.maxVersion ?? 0) + 1

        const [createdForm] = await tx
          .insert(trackableForms)
          .values({
            trackableId: trackableRecord.id,
            version: nextVersion,
            title: `${trackableRecord.name} feedback form`,
            description:
              trackableRecord.description ??
              "Fill out the form below and submit your response.",
            status: "draft",
            submitLabel: "Submit response",
            successMessage: "Thanks for your response.",
          })
          .returning()

        await tx
          .update(trackableItems)
          .set({
            activeFormId: createdForm.id,
          })
          .where(eq(trackableItems.id, trackableRecord.id))

        return createdForm
      })

      return {
        id: form.id,
        version: form.version,
        title: form.title,
        description: form.description,
        status: form.status,
        submitLabel: form.submitLabel,
        successMessage: form.successMessage,
        fields: [],
      }
    }),
  saveForm: protectedProcedure
    .input(saveTrackableFormSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const trackable = await assertProjectAccess(
        input.trackableId,
        userId,
        "manage"
      )

      assertTrackableKind(
        trackable.kind,
        "survey",
        "Only survey trackables can save forms."
      )

      const normalizedForm = normalizeEditableForm(input.form)

      const savedForm = await db.transaction(async (tx) => {
        const [versionResult] = await tx
          .select({
            maxVersion: max(trackableForms.version),
          })
          .from(trackableForms)
          .where(eq(trackableForms.trackableId, trackable.id))

        const nextVersion = (versionResult?.maxVersion ?? 0) + 1

        const [createdForm] = await tx
          .insert(trackableForms)
          .values({
            trackableId: trackable.id,
            version: nextVersion,
            title: normalizedForm.title,
            description: normalizedForm.description,
            status: normalizedForm.status,
            submitLabel: normalizedForm.submitLabel,
            successMessage: normalizedForm.successMessage,
          })
          .returning()

        await tx
          .update(trackableItems)
          .set({
            activeFormId: createdForm.id,
          })
          .where(eq(trackableItems.id, trackable.id))

        if (normalizedForm.fields.length > 0) {
          const createdFields = await tx
            .insert(trackableFormFields)
            .values(
              normalizedForm.fields.map((field, index) => ({
                formId: createdForm.id,
                key: field.key,
                kind: field.kind,
                label: field.label,
                description: field.description ?? null,
                required: field.required,
                position: index,
                config: field.config,
              }))
            )
            .returning()

          return {
            id: createdForm.id,
            version: createdForm.version,
            title: createdForm.title,
            description: createdForm.description,
            status: createdForm.status,
            submitLabel: createdForm.submitLabel,
            successMessage: createdForm.successMessage,
            fields: createdFields
              .sort((left, right) => left.position - right.position)
              .map((field) => ({
                id: field.id,
                key: field.key,
                kind: field.kind,
                label: field.label,
                description: field.description,
                required: field.required,
                position: field.position,
                config: field.config,
              })),
          }
        }

        return {
          id: createdForm.id,
          version: createdForm.version,
          title: createdForm.title,
          description: createdForm.description,
          status: createdForm.status,
          submitLabel: createdForm.submitLabel,
          successMessage: createdForm.successMessage,
          fields: [],
        }
      })

      return savedForm
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

      const activeWorkspace = await resolveActiveWorkspace(userId)
      const slug = generateSlug(input.name)

      const [newTrackable] = await db.transaction(async (tx) => {
        const [createdTrackable] = await tx
          .insert(trackableItems)
          .values({
            workspaceId: activeWorkspace.workspaceId,
            kind: input.kind,
            name: input.name,
            description: input.description,
            slug,
          })
          .returning()

        if (input.kind === "survey") {
          const [createdForm] = await tx
            .insert(trackableForms)
            .values({
              trackableId: createdTrackable.id,
              version: 1,
              title: `${createdTrackable.name} feedback form`,
              description:
                createdTrackable.description ??
                "Fill out the form below and submit your response.",
              status: "draft",
              submitLabel: "Submit response",
              successMessage: "Thanks for your response.",
            })
            .returning()

          await tx
            .update(trackableItems)
            .set({
              activeFormId: createdForm.id,
            })
            .where(eq(trackableItems.id, createdTrackable.id))
        }

        return [createdTrackable]
      })

      return newTrackable
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

      const trackable = await assertProjectAccess(
        input.trackableId,
        userId,
        "manage"
      )

      const trackableRecord = await db.query.trackableItems.findFirst({
        where: eq(trackableItems.id, trackable.id),
        columns: {
          id: true,
          kind: true,
          settings: true,
        },
      })

      if (!trackableRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trackable not found.",
        })
      }

      const existingSettings = trackableRecord.settings || {}
      const nextSettings =
        trackableRecord.kind === "survey"
          ? {
              ...existingSettings,
              allowAnonymousSubmissions:
                input.allowAnonymousSubmissions ?? true,
            }
          : {
              ...existingSettings,
              apiLogRetentionDays: input.apiLogRetentionDays ?? null,
            }

      const [updated] = await db
        .update(trackableItems)
        .set({
          name: input.name,
          description: input.description,
          settings: nextSettings,
        })
        .where(eq(trackableItems.id, trackableRecord.id))
        .returning()

      return updated
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

      await assertProjectAccess(input.trackableId, userId, "manage")

      const normalizedEmail = input.email.trim().toLowerCase()

      const existingGrant = await db.query.trackableAccessGrants.findFirst({
        where: and(
          eq(trackableAccessGrants.trackableId, input.trackableId),
          eq(trackableAccessGrants.subjectEmail, normalizedEmail)
        ),
        columns: {
          id: true,
        },
      })

      if (existingGrant) {
        const [updatedGrant] = await db
          .update(trackableAccessGrants)
          .set({
            role: input.role,
            revokedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(trackableAccessGrants.id, existingGrant.id))
          .returning()

        return updatedGrant
      }

      const [createdGrant] = await db
        .insert(trackableAccessGrants)
        .values({
          trackableId: input.trackableId,
          subjectType: "email",
          subjectEmail: normalizedEmail,
          role: input.role,
          createdByUserId: userId,
        })
        .returning()

      return createdGrant
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

      await assertProjectAccess(input.trackableId, userId, "manage")

      const existingGrant = await db.query.trackableAccessGrants.findFirst({
        where: and(
          eq(trackableAccessGrants.id, input.grantId),
          eq(trackableAccessGrants.trackableId, input.trackableId)
        ),
        columns: {
          id: true,
        },
      })

      if (!existingGrant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share permission not found.",
        })
      }

      const [updatedGrant] = await db
        .update(trackableAccessGrants)
        .set({
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(trackableAccessGrants.id, existingGrant.id))
        .returning()

      return updatedGrant
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

      const trackable = await assertProjectAccess(
        input.trackableId,
        userId,
        "manage"
      )

      assertTrackableKind(
        trackable.kind,
        "survey",
        "Only survey trackables can create share links."
      )

      const [createdLink] = await db
        .insert(trackableShareLinks)
        .values({
          trackableId: input.trackableId,
          token: createShareToken(),
          role: input.role,
          createdByUserId: userId,
        })
        .returning()

      return createdLink
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

      const trackable = await assertProjectAccess(
        input.trackableId,
        userId,
        "manage"
      )

      assertTrackableKind(
        trackable.kind,
        "survey",
        "Only survey trackables can update share links."
      )

      const existingLink = await db.query.trackableShareLinks.findFirst({
        where: and(
          eq(trackableShareLinks.id, input.linkId),
          eq(trackableShareLinks.trackableId, input.trackableId)
        ),
        columns: {
          id: true,
        },
      })

      if (!existingLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share link not found.",
        })
      }

      const [updatedLink] = await db
        .update(trackableShareLinks)
        .set({
          role: input.role,
          revokedAt: input.isActive ? null : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(trackableShareLinks.id, existingLink.id))
        .returning()

      return updatedLink
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

      const trackable = await assertProjectAccess(
        input.trackableId,
        userId,
        "manage"
      )

      assertTrackableKind(
        trackable.kind,
        "api_ingestion",
        "Only log trackables can create API keys."
      )

      const plaintextKey = buildApiKeySecret()
      const expiresAt = resolveApiKeyExpiration(input.expirationPreset)

      const [createdKey] = await db
        .insert(apiKeys)
        .values({
          workspaceId: trackable.workspaceId,
          projectId: trackable.id,
          name: input.name,
          keyPrefix: plaintextKey.slice(0, 20),
          secretHash: hashApiKey(plaintextKey),
          lastFour: plaintextKey.slice(-4),
          expiresAt,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          status: apiKeys.status,
          expiresAt: apiKeys.expiresAt,
        })

      return {
        id: createdKey.id,
        name: createdKey.name,
        status: createdKey.status,
        expiresAt: createdKey.expiresAt?.toISOString() ?? null,
        plaintextKey,
      }
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

      await assertProjectAccess(input.trackableId, userId, "manage")

      const existingKey = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, input.apiKeyId),
          eq(apiKeys.projectId, input.trackableId)
        ),
        columns: {
          id: true,
          status: true,
        },
      })

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found.",
        })
      }

      if (existingKey.status === "revoked") {
        return existingKey
      }

      const [revokedKey] = await db
        .update(apiKeys)
        .set({
          status: "revoked",
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, existingKey.id))
        .returning({
          id: apiKeys.id,
          status: apiKeys.status,
        })

      return revokedKey
    }),
})
