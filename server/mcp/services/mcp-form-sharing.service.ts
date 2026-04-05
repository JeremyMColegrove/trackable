import "server-only"

import { buildAbsoluteUrl } from "@/lib/site-config"
import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import { McpToolError } from "@/server/mcp/errors/mcp-errors"
import { mcpTrackableService } from "@/server/mcp/services/mcp-trackable.service"
import { shareLinkService } from "@/server/services/share-link.service"
import { trackableMutationService } from "@/server/services/trackable-mutation.service"

export interface McpFormSharingInput {
  enablePublicLink?: boolean
  allowAnonymousResponses?: boolean
}

export interface McpFormSharingResult {
  success: boolean
  trackableId: string
  publicLinkEnabled: boolean
  allowAnonymousResponses: boolean
  publicShareUrl: string | null
  linkId?: string | null
}

function buildPublicShareUrl(token: string) {
  return buildAbsoluteUrl(`/share/${token}`).toString()
}

export class McpFormSharingService {
  async updateSharing(
    trackableId: string,
    input: McpFormSharingInput,
    authContext: McpAuthContext
  ): Promise<McpFormSharingResult> {
    const trackable = await mcpTrackableService.assertAccess(
      trackableId,
      authContext
    )

    if (trackable.kind !== "survey") {
      throw new McpToolError(
        "FORBIDDEN",
        `Trackable "${trackable.name}" is of kind "${trackable.kind}". Only survey trackables can update form sharing.`
      )
    }

    let shareLink = await shareLinkService.findLatestShareLink(trackableId)

    if (input.enablePublicLink === true) {
      if (!shareLink) {
        shareLink = await shareLinkService.createShareLink({
          trackableId,
          userId: authContext.userId,
          role: "submit",
        })
      } else if (shareLink.revokedAt) {
        shareLink = await shareLinkService.updateShareLink({
          trackableId,
          userId: authContext.userId,
          linkId: shareLink.id,
          role: "submit",
          isActive: true,
        })
      }
    } else if (
      input.enablePublicLink === false &&
      shareLink &&
      !shareLink.revokedAt
    ) {
      shareLink = await shareLinkService.updateShareLink({
        trackableId,
        userId: authContext.userId,
        linkId: shareLink.id,
        role: "submit",
        isActive: false,
      })
    }

    let allowAnonymousResponses =
      trackable.settings?.allowAnonymousSubmissions ?? true

    if (typeof input.allowAnonymousResponses === "boolean") {
      const updatedTrackable =
        await trackableMutationService.updateSurveyAnonymousResponses({
          trackableId,
          userId: authContext.userId,
          allowAnonymousSubmissions: input.allowAnonymousResponses,
        })

      allowAnonymousResponses =
        updatedTrackable.settings?.allowAnonymousSubmissions ?? true
    }

    const publicLinkEnabled = Boolean(shareLink && !shareLink.revokedAt)

    return {
      success: true,
      trackableId,
      publicLinkEnabled,
      allowAnonymousResponses,
      publicShareUrl:
        shareLink && !shareLink.revokedAt
          ? buildPublicShareUrl(shareLink.token)
          : null,
      linkId: shareLink?.id ?? null,
    }
  }
}

export const mcpFormSharingService = new McpFormSharingService()
