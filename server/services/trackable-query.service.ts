import "server-only"

import { TRPCError } from "@trpc/server"
import { count, desc, eq, max } from "drizzle-orm"

import { db, withUserContext } from "@/db"
import {
  apiKeys,
  trackableApiUsageEvents,
  trackableFormSubmissions,
  trackableItems,
} from "@/db/schema"
import { accessControlService } from "@/server/services/access-control.service"

export class TrackableQueryService {
  private async resolveTrackableAccess(trackableId: string, userId: string) {
    await accessControlService.assertTrackableAccess(
      trackableId,
      userId,
      "view"
    )

    let canManageTrackable = false

    try {
      await accessControlService.assertTrackableAccess(
        trackableId,
        userId,
        "manage"
      )
      canManageTrackable = true
    } catch (error) {
      if (!(error instanceof TRPCError) || error.code !== "NOT_FOUND") {
        throw error
      }
    }

    return {
      canManageTrackable,
    }
  }

  private buildPermissions(
    kind: "survey" | "api_ingestion",
    canManageTrackable: boolean
  ) {
    return {
      canManageTrackable,
      canManageResponses: canManageTrackable && kind === "survey",
      canManageForm: canManageTrackable && kind === "survey",
      canManageSettings: canManageTrackable,
      canManageApiKeys: canManageTrackable && kind === "api_ingestion",
    }
  }

  private async getRequiredTrackable(trackableId: string) {
    const trackable = await db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, trackableId),
    })

    if (!trackable || trackable.archivedAt) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    return trackable
  }

  async getShellById(trackableId: string, userId: string) {
    const { canManageTrackable } = await this.resolveTrackableAccess(
      trackableId,
      userId
    )

    return withUserContext(userId, async (db) => {
      const trackable = await db.query.trackableItems.findFirst({
        where: eq(trackableItems.id, trackableId),
      })

      if (!trackable || trackable.archivedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trackable not found.",
        })
      }

      const permissions = this.buildPermissions(trackable.kind, canManageTrackable)

      const ownedApiKeys = permissions.canManageApiKeys
        ? await db.query.apiKeys.findMany({
            where: eq(apiKeys.projectId, trackable.id),
            orderBy: [desc(apiKeys.createdAt)],
          })
        : []

      return {
        id: trackable.id,
        kind: trackable.kind,
        name: trackable.name,
        description: trackable.description,
        permissions,
        settings: trackable.settings,
        createdAt: trackable.createdAt.toISOString(),
        submissionCount: trackable.submissionCount,
        apiUsageCount: trackable.apiUsageCount,
        lastSubmissionAt: trackable.lastSubmissionAt?.toISOString() ?? null,
        lastApiUsageAt: trackable.lastApiUsageAt?.toISOString() ?? null,
        activeForm: null,
        recentSubmissions: [],
        apiKeys: permissions.canManageApiKeys
          ? ownedApiKeys.map((key) => ({
              id: key.id,
              name: key.name,
              maskedKey: `${key.keyPrefix}...${key.lastFour}`,
              status: key.status,
              expiresAt: key.expiresAt?.toISOString() ?? null,
              trackableUsageCount: 0,
              lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
            }))
          : [],
        shareSettings: {
          accessGrants: [],
          shareLinks: [],
        },
      }
    })
  }

  async getById(trackableId: string, userId: string) {
    const { canManageTrackable } = await this.resolveTrackableAccess(
      trackableId,
      userId
    )

    return withUserContext(userId, async (db) => {
    const trackable = await db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, trackableId),
      with: {
        activeForm: {
          with: {
            fields: true,
          },
        },
        accessGrants: {
          orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
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
          orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
        },
      },
    })

    if (!trackable || trackable.archivedAt) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    const permissions = this.buildPermissions(
      trackable.kind,
      canManageTrackable
    )

    const [submissions, ownedApiKeys, usageCountsByKey] = await Promise.all([
      db.query.trackableFormSubmissions.findMany({
        where: eq(trackableFormSubmissions.trackableId, trackable.id),
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
        where: eq(apiKeys.projectId, trackable.id),
        orderBy: [desc(apiKeys.createdAt)],
      }),
      db
        .select({
          apiKeyId: trackableApiUsageEvents.apiKeyId,
          usageCount: count(trackableApiUsageEvents.id),
          lastOccurredAt: max(trackableApiUsageEvents.occurredAt),
        })
        .from(trackableApiUsageEvents)
        .where(eq(trackableApiUsageEvents.trackableId, trackable.id))
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
      id: trackable.id,
      kind: trackable.kind,
      name: trackable.name,
      description: trackable.description,
      permissions,
      settings: trackable.settings,
      createdAt: trackable.createdAt.toISOString(),
      submissionCount: trackable.submissionCount,
      apiUsageCount: trackable.apiUsageCount,
      lastSubmissionAt: trackable.lastSubmissionAt?.toISOString() ?? null,
      lastApiUsageAt: trackable.lastApiUsageAt?.toISOString() ?? null,
      activeForm: trackable.activeForm
        ? {
            id: trackable.activeForm.id,
            version: trackable.activeForm.version,
            title: trackable.activeForm.title,
            description: trackable.activeForm.description,
            status: trackable.activeForm.status,
            submitLabel: trackable.activeForm.submitLabel,
            successMessage: trackable.activeForm.successMessage,
            fields: [...trackable.activeForm.fields].sort(
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
      apiKeys: permissions.canManageApiKeys
        ? ownedApiKeys.map((key) => {
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
          })
        : [],
      shareSettings: {
        accessGrants: permissions.canManageTrackable
          ? trackable.accessGrants.map((grant) => ({
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
            }))
          : [],
        shareLinks: permissions.canManageTrackable
          ? trackable.shareLinks.map((link) => ({
              id: link.id,
              token: link.token,
              role: link.role,
              createdAt: link.createdAt.toISOString(),
              expiresAt: link.expiresAt?.toISOString() ?? null,
              revokedAt: link.revokedAt?.toISOString() ?? null,
              lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
              usageCount: link.usageCount,
            }))
          : [],
      },
    }
  })
}
}

export const trackableQueryService = new TrackableQueryService()
