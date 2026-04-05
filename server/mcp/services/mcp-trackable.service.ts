import "server-only"

import {
  and,
  eq,
  ilike,
  inArray,
  isNull,
  or,
} from "drizzle-orm"

import { db } from "@/db"
import { trackableItems } from "@/db/schema"

import { buildAbsoluteUrl } from "@/lib/site-config"
import {
  McpTrackableService,
  type McpTrackableCreationInput,
  type McpTrackableRecord,
  type McpTrackableServiceDependencies,
} from "@/server/mcp/services/mcp-trackable.service-core"
import { mcpWorkspaceService } from "@/server/mcp/services/mcp-workspace.service"
import { trackableMutationService } from "@/server/services/trackable-mutation.service"

const mcpTrackableServiceDependencies: McpTrackableServiceDependencies = {
  listAccessibleWorkspaces: (authContext) =>
    mcpWorkspaceService.listAccessible(authContext),
  async listTrackableRows(options) {
    const {
      workspaceIds,
      kind,
      includeArchived = false,
      trackableIds,
      query,
      queryTokens = [],
    } = options

    if (workspaceIds.length === 0) {
      return []
    }

    if (trackableIds?.length === 0) {
      return []
    }

    const conditions = [inArray(trackableItems.workspaceId, workspaceIds)]

    if (!includeArchived) {
      conditions.push(isNull(trackableItems.archivedAt))
    }

    if (kind) {
      conditions.push(eq(trackableItems.kind, kind))
    }

    if (trackableIds && trackableIds.length > 0) {
      conditions.push(inArray(trackableItems.id, trackableIds))
    }

    const searchPatterns = new Set<string>()
    if (query) {
      searchPatterns.add(`%${query}%`)
    }
    for (const token of queryTokens) {
      if (token) {
        searchPatterns.add(`%${token}%`)
      }
    }

    if (searchPatterns.size > 0) {
      conditions.push(
        or(
          ...Array.from(searchPatterns).flatMap((pattern) => [
            ilike(trackableItems.name, pattern),
            ilike(trackableItems.slug, pattern),
          ])
        )!
      )
    }

    return db
      .select({
        id: trackableItems.id,
        workspaceId: trackableItems.workspaceId,
        name: trackableItems.name,
        slug: trackableItems.slug,
        kind: trackableItems.kind,
        submissionCount: trackableItems.submissionCount,
        apiUsageCount: trackableItems.apiUsageCount,
        lastSubmissionAt: trackableItems.lastSubmissionAt,
        lastApiUsageAt: trackableItems.lastApiUsageAt,
        archivedAt: trackableItems.archivedAt,
      })
      .from(trackableItems)
      .where(and(...conditions))
  },
  findTrackableById(trackableId) {
    return db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, trackableId),
    }) as Promise<McpTrackableRecord | undefined>
  },
  async findTrackableByName(workspaceId, name) {
    return db.query.trackableItems.findFirst({
      where: and(
        eq(trackableItems.workspaceId, workspaceId),
        ilike(trackableItems.name, name),
        isNull(trackableItems.archivedAt)
      ),
      columns: { id: true, name: true },
    })
  },
  createTrackable(authContext, input: McpTrackableCreationInput) {
    return trackableMutationService.create({
      workspaceId: input.workspaceId,
      kind: input.kind,
      name: input.name,
      description: input.description,
      userId: authContext.userId,
    })
  },
  buildAdminUrl(trackableId) {
    return buildAbsoluteUrl(`/dashboard/trackables/${trackableId}`).toString()
  },
}

export {
  McpTrackableService,
  type McpTrackableCreationResult,
  type McpTrackableFindOptions,
  type McpTrackableFindResult,
  type McpTrackableItem,
  type McpTrackableListOptions,
  type McpTrackableSearchResult,
  type McpTrackableServiceDependencies,
} from "@/server/mcp/services/mcp-trackable.service-core"

export const mcpTrackableService = new McpTrackableService(
  mcpTrackableServiceDependencies
)
