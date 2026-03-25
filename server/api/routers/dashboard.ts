import { TRPCError } from "@trpc/server"
import { and, desc, eq, gte, isNull, sum } from "drizzle-orm"

import { db } from "@/db"
import {
  trackableApiUsageEvents,
  trackableFormSubmissions,
  trackableItems,
} from "@/db/schema"
import { accessControlService } from "@/server/services/access-control.service"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

const ACTIVITY_WINDOW_DAYS = 7
const DAY_IN_MS = 24 * 60 * 60 * 1000

function getWindowStart(now: Date) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (ACTIVITY_WINDOW_DAYS - 1))
  return start
}

function createEmptyActivitySeries() {
  return Array.from({ length: ACTIVITY_WINDOW_DAYS }, (_, index) => ({
    dayOffset: index,
    count: 0,
  }))
}

function getDayOffset(date: Date, windowStart: Date) {
  const eventDay = new Date(date)
  eventDay.setHours(0, 0, 0, 0)

  return Math.floor((eventDay.getTime() - windowStart.getTime()) / DAY_IN_MS)
}

export const dashboardRouter = createTRPCRouter({
  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    const now = new Date()
    const windowStart = getWindowStart(now)
    const activeWorkspace = await accessControlService.resolveActiveWorkspace(userId)

    const [submissionTotals, recentSubmissions, recentUsageEvents] =
      await Promise.all([
        db
          .select({
            totalSubmissions: sum(trackableItems.submissionCount),
            totalUsageTracks: sum(trackableItems.apiUsageCount),
          })
          .from(trackableItems)
          .where(eq(trackableItems.workspaceId, activeWorkspace.workspaceId)),
        db
          .select({
            createdAt: trackableFormSubmissions.createdAt,
          })
          .from(trackableFormSubmissions)
          .innerJoin(
            trackableItems,
            eq(trackableItems.id, trackableFormSubmissions.trackableId)
          )
          .where(
            and(
              eq(trackableItems.workspaceId, activeWorkspace.workspaceId),
              gte(trackableFormSubmissions.createdAt, windowStart)
            )
          ),
        db
          .select({
            occurredAt: trackableApiUsageEvents.occurredAt,
          })
          .from(trackableApiUsageEvents)
          .innerJoin(
            trackableItems,
            eq(trackableItems.id, trackableApiUsageEvents.trackableId)
          )
          .where(
            and(
              eq(trackableItems.workspaceId, activeWorkspace.workspaceId),
              gte(trackableApiUsageEvents.occurredAt, windowStart)
            )
          ),
      ])

    const trackablesCount = await db.$count(
      trackableItems,
      eq(trackableItems.workspaceId, activeWorkspace.workspaceId)
    )
    const activeTrackablesCount = await db.$count(
      trackableItems,
      and(
        eq(trackableItems.workspaceId, activeWorkspace.workspaceId),
        isNull(trackableItems.archivedAt)
      )
    )

    const activeSurveysCount = await db.$count(
      trackableItems,
      and(
        eq(trackableItems.workspaceId, activeWorkspace.workspaceId),
        eq(trackableItems.kind, "survey"),
        isNull(trackableItems.archivedAt)
      )
    )

    const totals = submissionTotals[0]
    const totalSubmissions = Number(totals?.totalSubmissions) || 0
    const totalUsageTracks = Number(totals?.totalUsageTracks) || 0
    const submissionActivity = createEmptyActivitySeries()
    const usageActivity = createEmptyActivitySeries()

    for (const submission of recentSubmissions) {
      const dayOffset = getDayOffset(submission.createdAt, windowStart)

      if (dayOffset >= 0 && dayOffset < ACTIVITY_WINDOW_DAYS) {
        submissionActivity[dayOffset]!.count += 1
      }
    }

    for (const usageEvent of recentUsageEvents) {
      const dayOffset = getDayOffset(usageEvent.occurredAt, windowStart)

      if (dayOffset >= 0 && dayOffset < ACTIVITY_WINDOW_DAYS) {
        usageActivity[dayOffset]!.count += 1
      }
    }

    return {
      activeTrackablesCount,
      trackablesCount,
      activeSurveysCount,
      recentLogsCount: recentUsageEvents.length,
      totalSubmissions,
      totalUsageTracks,
      submissionActivity,
      usageActivity,
    }
  }),

  getTrackables: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    const activeWorkspace = await accessControlService.resolveActiveWorkspace(userId)

    return db.query.trackableItems.findMany({
      where: eq(trackableItems.workspaceId, activeWorkspace.workspaceId),
      orderBy: [desc(trackableItems.createdAt)],
      limit: 10,
      columns: {
        id: true,
        kind: true,
        name: true,
        submissionCount: true,
        apiUsageCount: true,
        updatedAt: true,
      },
      with: {
        workspace: {
          columns: {
            name: true,
          },
        },
      },
    })
  }),
})
