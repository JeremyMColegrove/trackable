import { and, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import {
  trackableApiUsageEvents,
  trackableFormSubmissions,
  trackableItems,
  trackableWebhookConnections,
  users,
  workspaceWebhookTriggerRules,
  workspaceWebhooks,
} from "@/db/schema"
import { USAGE_EVENT_PAGE_SIZE } from "@/server/usage-tracking/usage-event-config"
import { UsageEventQueryPlanner } from "@/server/usage-tracking/usage-event-query-planner"
import { UsageEventSearchParser } from "@/server/usage-tracking/usage-event-search-parser"
import { UsageEventSqlRepository } from "@/server/usage-tracking/usage-event-sql-repository"
import type {
  AttachedWebhookRecord,
  WebhookEventRepositoryContract,
  WebhookSurveyResponseEvent,
  WebhookUsageEvent,
  WorkspaceWebhookRecord,
} from "@/server/webhooks/webhook.types"

export class WebhookRepository implements WebhookEventRepositoryContract {
  private readonly usageEventSearchParser = new UsageEventSearchParser()
  private readonly usageEventQueryPlanner = new UsageEventQueryPlanner()
  private readonly usageEventSqlRepository = new UsageEventSqlRepository(db)

  private async resolvePersistedUserId(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
      },
    })

    return user?.id ?? null
  }

  async listWorkspaceWebhooks(
    workspaceId: string
  ): Promise<WorkspaceWebhookRecord[]> {
    const rows = await db.query.workspaceWebhooks.findMany({
      where: eq(workspaceWebhooks.workspaceId, workspaceId),
      orderBy: [desc(workspaceWebhooks.createdAt)],
      with: {
        triggerRules: {
          orderBy: [workspaceWebhookTriggerRules.position],
        },
      },
    })

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      provider: row.provider,
      config: row.config,
      enabled: row.enabled,
      triggerRules: row.triggerRules.map((rule) => ({
        id: rule.id,
        webhookId: rule.webhookId,
        enabled: rule.enabled,
        position: rule.position,
        config: rule.config,
      })),
    }))
  }

  async getWorkspaceWebhookById(
    webhookId: string
  ): Promise<WorkspaceWebhookRecord | null> {
    const row = await db.query.workspaceWebhooks.findFirst({
      where: eq(workspaceWebhooks.id, webhookId),
      with: {
        triggerRules: {
          orderBy: [workspaceWebhookTriggerRules.position],
        },
      },
    })

    if (!row) {
      return null
    }

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      provider: row.provider,
      config: row.config,
      enabled: row.enabled,
      triggerRules: row.triggerRules.map((rule) => ({
        id: rule.id,
        webhookId: rule.webhookId,
        enabled: rule.enabled,
        position: rule.position,
        config: rule.config,
      })),
    }
  }

  async createWebhook(input: {
    workspaceId: string
    userId: string
    name: string
    provider: WorkspaceWebhookRecord["config"]
    enabled: boolean
    triggerRules: Array<{
      enabled: boolean
      config: WorkspaceWebhookRecord["triggerRules"][number]["config"]
    }>
  }) {
    return db.transaction(async (tx) => {
      const createdByUserId = await this.resolvePersistedUserId(input.userId)

      const [webhook] = await tx
        .insert(workspaceWebhooks)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          provider: input.provider.provider,
          config: input.provider,
          enabled: input.enabled,
          createdByUserId,
        })
        .returning({
          id: workspaceWebhooks.id,
        })

      await tx.insert(workspaceWebhookTriggerRules).values(
        input.triggerRules.map((rule, index) => ({
          webhookId: webhook.id,
          enabled: rule.enabled,
          position: index,
          type: rule.config.type,
          config: rule.config,
        }))
      )

      return webhook.id
    })
  }

  async updateWebhook(input: {
    webhookId: string
    name: string
    provider: WorkspaceWebhookRecord["config"]
    enabled: boolean
    triggerRules: Array<{
      enabled: boolean
      config: WorkspaceWebhookRecord["triggerRules"][number]["config"]
    }>
  }) {
    await db.transaction(async (tx) => {
      await tx
        .update(workspaceWebhooks)
        .set({
          name: input.name,
          provider: input.provider.provider,
          config: input.provider,
          enabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(workspaceWebhooks.id, input.webhookId))

      await tx
        .delete(workspaceWebhookTriggerRules)
        .where(eq(workspaceWebhookTriggerRules.webhookId, input.webhookId))

      await tx.insert(workspaceWebhookTriggerRules).values(
        input.triggerRules.map((rule, index) => ({
          webhookId: input.webhookId,
          enabled: rule.enabled,
          position: index,
          type: rule.config.type,
          config: rule.config,
        }))
      )
    })
  }

  async deleteWebhook(webhookId: string) {
    await db
      .delete(workspaceWebhooks)
      .where(eq(workspaceWebhooks.id, webhookId))
  }

  async attachWebhookToTrackable(input: {
    trackableId: string
    webhookId: string
    userId: string
  }) {
    const createdByUserId = await this.resolvePersistedUserId(input.userId)

    await db
      .insert(trackableWebhookConnections)
      .values({
        trackableId: input.trackableId,
        webhookId: input.webhookId,
        createdByUserId,
      })
      .onConflictDoNothing()
  }

  async detachWebhookFromTrackable(input: {
    trackableId: string
    webhookId: string
  }) {
    await db
      .delete(trackableWebhookConnections)
      .where(
        and(
          eq(trackableWebhookConnections.trackableId, input.trackableId),
          eq(trackableWebhookConnections.webhookId, input.webhookId)
        )
      )
  }

  async listTrackableWebhooks(
    trackableId: string
  ): Promise<AttachedWebhookRecord[]> {
    const rows = await db.query.trackableWebhookConnections.findMany({
      where: eq(trackableWebhookConnections.trackableId, trackableId),
      with: {
        webhook: {
          with: {
            triggerRules: {
              orderBy: [workspaceWebhookTriggerRules.position],
            },
          },
        },
      },
    })

    return rows.map((row) => ({
      trackableId: row.trackableId,
      id: row.webhook.id,
      workspaceId: row.webhook.workspaceId,
      name: row.webhook.name,
      provider: row.webhook.provider,
      config: row.webhook.config,
      enabled: row.webhook.enabled,
      triggerRules: row.webhook.triggerRules.map((rule) => ({
        id: rule.id,
        webhookId: rule.webhookId,
        enabled: rule.enabled,
        position: rule.position,
        config: rule.config,
      })),
    }))
  }

  async getTrackable(trackableId: string) {
    const trackable = await db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, trackableId),
      columns: {
        id: true,
        workspaceId: true,
        kind: true,
      },
    })

    return trackable ?? null
  }

  async getUsageEventById(eventId: string): Promise<WebhookUsageEvent | null> {
    const event = await db.query.trackableApiUsageEvents.findFirst({
      where: eq(trackableApiUsageEvents.id, eventId),
      with: {
        apiKey: {
          columns: {
            workspaceId: true,
          },
        },
      },
    })

    if (!event) {
      return null
    }

    return {
      kind: "usage_event",
      id: event.id,
      trackableId: event.trackableId,
      workspaceId: event.apiKey.workspaceId,
      occurredAt: event.occurredAt,
      payload: event.payload,
      metadata: event.metadata,
    }
  }

  async getSurveyResponseEventById(
    submissionId: string
  ): Promise<WebhookSurveyResponseEvent | null> {
    const submission = await db.query.trackableFormSubmissions.findFirst({
      where: eq(trackableFormSubmissions.id, submissionId),
      with: {
        trackable: {
          columns: {
            workspaceId: true,
          },
        },
        submittedByUser: {
          columns: {
            displayName: true,
          },
        },
      },
    })

    if (!submission) {
      return null
    }

    return {
      kind: "survey_response",
      id: submission.id,
      trackableId: submission.trackableId,
      workspaceId: submission.trackable.workspaceId,
      occurredAt: submission.createdAt,
      payload: {
        source: submission.source,
        submitterLabel:
          submission.submittedByUser?.displayName ??
          submission.submittedEmail ??
          "Anonymous",
        submissionSnapshot: submission.submissionSnapshot,
      },
      metadata: submission.metadata,
    }
  }

  async countMatchingEvents(input: {
    filterQuery: string
    trackableId: string
    occurredAfter?: Date | null
    occurredBefore?: Date | null
  }) {
    const parsedSearch = this.usageEventSearchParser.parse({
      trackableId: input.trackableId,
      query: input.filterQuery === "*" ? "" : input.filterQuery,
      aggregation: "none",
      aggregateField: null,
      sort: "lastOccurredAt",
      dir: "desc",
      from: input.occurredAfter?.toISOString() ?? null,
      to: input.occurredBefore?.toISOString() ?? null,
      cursor: null,
      pageSize: USAGE_EVENT_PAGE_SIZE,
    })
    const plan = this.usageEventQueryPlanner.plan(parsedSearch)

    return this.usageEventSqlRepository.countFlatRows(plan)
  }
}

export const webhookRepository = new WebhookRepository()
