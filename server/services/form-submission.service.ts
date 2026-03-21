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
import { assertTrackableKind } from "@/server/services/project.service"
import { quotaService } from "@/server/subscriptions/quota.service"

export class FormSubmissionService {
  async submitSharedForm(input: {
    token: string
    answers: Array<{ fieldId: string; value: unknown }>
    responderEmail?: string | null
    metadata?: { locale?: string; userAgent?: string; referrer?: string } | null
    userId: string | null
  }) {
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

    if (requiresAuthenticatedSharedFormAccess(settings) && !input.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be signed in to submit this form.",
      })
    }

    if (
      input.userId &&
      (await hasAuthenticatedSharedFormSubmission({
        shareLinkId: shareLink.id,
        userId: input.userId,
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

    await quotaService.assertCanSubmitResponse(shareLink.trackableId)

    const [createdSubmission] = await db.transaction(async (tx) => {
      const [submission] = await tx
        .insert(trackableFormSubmissions)
        .values({
          trackableId: shareLink.trackableId,
          formId: form.id,
          shareLinkId: shareLink.id,
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
  }
}

export const formSubmissionService = new FormSubmissionService()
