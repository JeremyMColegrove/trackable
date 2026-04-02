import "server-only"

import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import {
  trackableFormAnswers,
  trackableFormSubmissions,
  trackableItems,
  trackableShareLinks,
} from "@/db/schema"
import type { TrackableFormSnapshot } from "@/db/schema/types"
import {
  buildSubmissionSnapshot,
  requiresResponderEmail,
} from "@/lib/trackable-form-submission"
import {
  getActiveShareLink,
  getShareLinkByToken,
  requiresAuthenticatedSharedFormAccess,
} from "@/lib/trackable-share-links"
import { hasAuthenticatedSharedFormSubmission } from "@/lib/shared-form-submissions"
import { quotaService } from "@/server/subscriptions/quota.service"
import { assertTrackableKind } from "@/server/services/trackable-kind"
import { webhookTriggerService } from "@/server/webhooks/webhook-trigger.service.singleton"
import { logger } from "@/lib/logger"

type SharedFormRuntime = {
  form: TrackableFormSnapshot
  settings: NonNullable<Awaited<ReturnType<typeof getActiveShareLink>>>["trackable"]["settings"] | null
  shareLink: NonNullable<Awaited<ReturnType<typeof getActiveShareLink>>>
}

export class SharedFormRuntimeService {
  async loadForViewer(token: string, viewerUserId: string | null) {
    const runtime = await this.loadRuntime(token)

    await quotaService.assertSurveyCanAcceptResponses(runtime.shareLink.trackable.id)

    const requiresAuthentication =
      runtime.shareLink.trackable.settings?.allowAnonymousSubmissions === false

    return {
      shareLink: runtime.shareLink,
      trackable: {
        id: runtime.shareLink.trackable.id,
        name: runtime.shareLink.trackable.name,
        description: runtime.shareLink.trackable.description,
        creatorName: runtime.shareLink.trackable.workspace.name,
      },
      form: runtime.form,
      settings: {
        allowAnonymousSubmissions:
          runtime.settings?.allowAnonymousSubmissions ?? true,
        collectResponderEmail: runtime.settings?.collectResponderEmail ?? false,
        requiresAuthentication,
      },
      viewer: {
        isAuthenticated: Boolean(viewerUserId),
        hasSubmitted:
          viewerUserId == null
            ? false
            : await hasAuthenticatedSharedFormSubmission({
                shareLinkId: runtime.shareLink.id,
                userId: viewerUserId,
              }),
      },
    }
  }

  async submit(input: {
    token: string
    answers: Array<{ fieldId: string; value: unknown }>
    responderEmail?: string | null
    metadata?: { locale?: string; userAgent?: string; referrer?: string } | null
    userId: string | null
  }) {
    const runtime = await this.loadRuntime(input.token)
    const responderEmail = await this.validateSubmissionAccess(runtime, {
      responderEmail: input.responderEmail,
      userId: input.userId,
    })

    let submissionData: ReturnType<typeof buildSubmissionSnapshot>

    try {
      submissionData = buildSubmissionSnapshot(runtime.form, input.answers)
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error
            ? error.message
            : "Unable to validate form answers.",
      })
    }

    await quotaService.assertCanSubmitResponse(runtime.shareLink.trackableId)

    const [createdSubmission] = await db.transaction(async (tx) => {
      const [submission] = await tx
        .insert(trackableFormSubmissions)
        .values({
          trackableId: runtime.shareLink.trackableId,
          formId: runtime.form.id,
          shareLinkId: runtime.shareLink.id,
          submittedByUserId: input.userId ?? null,
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
          submissionCount: runtime.shareLink.trackable.submissionCount + 1,
          lastSubmissionAt: submission.createdAt,
          updatedAt: new Date(),
        })
        .where(eq(trackableItems.id, runtime.shareLink.trackableId))

      await tx
        .update(trackableShareLinks)
        .set({
          usageCount: runtime.shareLink.usageCount + 1,
          lastUsedAt: submission.createdAt,
          updatedAt: new Date(),
        })
        .where(eq(trackableShareLinks.id, runtime.shareLink.id))

      return [submission]
    })

    try {
      await webhookTriggerService.handleSurveyResponseRecorded({
        id: createdSubmission.id,
        occurredAt: createdSubmission.createdAt,
        trackableId: runtime.shareLink.trackableId,
        workspaceId: runtime.shareLink.trackable.workspaceId,
      })
    } catch (error) {
      logger.error(
        {
          err: error,
          submissionId: createdSubmission.id,
          trackableId: runtime.shareLink.trackableId,
        },
        "Webhook processing failed after recording a survey response."
      )
    }

    return {
      id: createdSubmission.id,
      createdAt: createdSubmission.createdAt.toISOString(),
      successMessage: runtime.form.successMessage ?? "Thanks for your response.",
    }
  }

  private async loadRuntime(token: string): Promise<SharedFormRuntime> {
    const shareLink = await getActiveShareLink(token)

    if (!shareLink) {
      const existingShareLink = await getShareLinkByToken(token)

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

    assertTrackableKind(
      shareLink.trackable.kind,
      "survey",
      "This shared form is not available for this trackable."
    )

    const form = this.buildActiveFormSnapshot(shareLink)

    return {
      form,
      settings: shareLink.trackable.settings ?? null,
      shareLink,
    }
  }

  private buildActiveFormSnapshot(
    shareLink: NonNullable<Awaited<ReturnType<typeof getActiveShareLink>>>
  ): TrackableFormSnapshot {
    const form = shareLink.trackable.activeForm

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

    return {
      id: form.id,
      version: form.version,
      title: form.title,
      description: form.description,
      status: form.status,
      submitLabel: form.submitLabel,
      successMessage: form.successMessage,
      fields: [...form.fields].sort((left, right) => left.position - right.position),
    }
  }

  private async validateSubmissionAccess(
    runtime: SharedFormRuntime,
    input: {
      responderEmail?: string | null
      userId: string | null
    }
  ) {
    if (
      requiresAuthenticatedSharedFormAccess(runtime.settings) &&
      !input.userId
    ) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be signed in to submit this form.",
      })
    }

    if (
      input.userId &&
      (await hasAuthenticatedSharedFormSubmission({
        shareLinkId: runtime.shareLink.id,
        userId: input.userId,
      }))
    ) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "You already submitted this form.",
      })
    }

    const responderEmail = input.responderEmail?.trim().toLowerCase()
    const shouldCollectEmail = requiresResponderEmail(runtime.settings)

    if (shouldCollectEmail && !responderEmail) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Responder email is required for this form configuration.",
      })
    }

    return responderEmail ?? null
  }
}

export const sharedFormRuntimeService = new SharedFormRuntimeService()
