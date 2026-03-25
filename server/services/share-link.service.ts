import "server-only"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { randomBytes } from "node:crypto"

import { db } from "@/db"
import { trackableAccessGrants, trackableShareLinks } from "@/db/schema"
import { getShareLinkByToken } from "@/lib/trackable-share-links"
import { hasAuthenticatedSharedFormSubmission } from "@/lib/shared-form-submissions"
import { accessControlService } from "@/server/services/access-control.service"
import { assertTrackableKind } from "@/server/services/project.service"
import { sharedFormCache } from "@/server/redis/shared-form-cache.repository"
import { quotaService } from "@/server/subscriptions/quota.service"

export type AccessRole = "submit" | "view" | "manage"

function createShareToken() {
  return randomBytes(18).toString("base64url")
}

export class ShareLinkService {
  async getSharedForm(token: string, viewerUserId: string | null) {
    const shareLink = await sharedFormCache.get(token)

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

    await quotaService.assertSurveyCanAcceptResponses(shareLink.trackable.id)

    const requiresAuthentication =
      shareLink.trackable.settings?.allowAnonymousSubmissions === false

    return {
      shareLink,
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
        isAuthenticated: Boolean(viewerUserId),
        hasSubmitted:
          viewerUserId == null
            ? false
            : await hasAuthenticatedSharedFormSubmission({
                shareLinkId: shareLink.id,
                userId: viewerUserId,
              }),
      },
    }
  }

  async upsertEmailGrant(input: {
    trackableId: string
    userId: string
    email: string
    role: AccessRole
  }) {
    await accessControlService.assertProjectAccess(
      input.trackableId,
      input.userId,
      "manage"
    )

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
        createdByUserId: input.userId,
      })
      .returning()

    return createdGrant
  }

  async revokeAccessGrant(input: {
    trackableId: string
    userId: string
    grantId: string
  }) {
    await accessControlService.assertProjectAccess(
      input.trackableId,
      input.userId,
      "manage"
    )

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
  }

  async createShareLink(input: {
    trackableId: string
    userId: string
    role: AccessRole
  }) {
    const trackable = await accessControlService.assertProjectAccess(
      input.trackableId,
      input.userId,
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
        createdByUserId: input.userId,
      })
      .returning()

    return createdLink
  }

  async updateShareLink(input: {
    trackableId: string
    userId: string
    linkId: string
    role: AccessRole
    isActive: boolean
  }) {
    const trackable = await accessControlService.assertProjectAccess(
      input.trackableId,
      input.userId,
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

    await sharedFormCache.invalidateForTrackable(input.trackableId)

    return updatedLink
  }
}

export const shareLinkService = new ShareLinkService()
