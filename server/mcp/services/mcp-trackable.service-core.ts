import type { TrackableKind, TrackableSettings } from "@/db/schema/types"
import { ConflictError } from "@/server/errors"
import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import {
  McpToolError,
  translateServiceError,
} from "@/server/mcp/errors/mcp-errors"
import type { McpWorkspaceSummary } from "@/server/mcp/services/mcp-workspace.service"

export interface McpTrackableRecord {
  id: string
  workspaceId: string
  name: string
  slug: string
  kind: TrackableKind
  description: string | null
  settings: TrackableSettings | null
  archivedAt: Date | null
}

interface TrackableDiscoveryRow {
  id: string
  workspaceId: string
  name: string
  slug: string
  kind: TrackableKind
  submissionCount: number
  apiUsageCount: number
  lastSubmissionAt: Date | null
  lastApiUsageAt: Date | null
  archivedAt: Date | null
}

type McpTrackableMatchKind =
  | "recent"
  | "exact_name"
  | "exact_slug"
  | "prefix_name"
  | "prefix_slug"
  | "substring_name"
  | "substring_slug"
  | "token_overlap"

/** Summary representation of a trackable returned by MCP discovery tools. */
export interface McpTrackableItem {
  id: string
  workspaceId: string
  name: string
  slug: string
  kind: TrackableKind
  submissionCount: number
  apiUsageCount: number
  lastActivityAt: string | null
  adminUrl: string
}

export interface McpTrackableListOptions {
  workspaceId?: string
  kind?: TrackableKind
  includeArchived?: boolean
}

export interface McpTrackableFindOptions {
  query?: string
  kind?: TrackableKind
  workspaceId?: string
  limit?: number
}

export interface McpTrackableSearchResult {
  trackable: McpTrackableItem
  workspace: McpWorkspaceSummary
  match: {
    kind: McpTrackableMatchKind
    score: number
  }
}

export interface McpTrackableFindResult {
  results: McpTrackableSearchResult[]
}

export interface McpTrackableCreationInput {
  workspaceId?: string
  kind: TrackableKind
  name: string
  description?: string
}

export interface McpTrackableCreationResult {
  id: string
  workspaceId: string
  kind: TrackableKind
  name: string
  slug: string
  description: string | null
  adminUrl: string
}

interface TrackableRowQueryOptions {
  workspaceIds: string[]
  kind?: TrackableKind
  includeArchived?: boolean
  trackableIds?: string[]
  query?: string
  queryTokens?: string[]
}

interface McpTrackableMutationResult {
  id: string
  workspaceId: string
  kind: TrackableKind
  name: string
  slug: string
  description: string | null
}

export interface McpTrackableServiceDependencies {
  listAccessibleWorkspaces(
    authContext: McpAuthContext
  ): Promise<McpWorkspaceSummary[]>
  listTrackableRows(
    options: TrackableRowQueryOptions
  ): Promise<TrackableDiscoveryRow[]>
  findTrackableById(
    trackableId: string
  ): Promise<McpTrackableRecord | undefined>
  findTrackableByName(
    workspaceId: string,
    name: string
  ): Promise<{ id: string; name: string } | undefined>
  createTrackable(
    authContext: McpAuthContext,
    input: McpTrackableCreationInput
  ): Promise<McpTrackableMutationResult>
  buildAdminUrl(trackableId: string): string
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ")
}

function tokenizeSearchValue(value: string): string[] {
  return value
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
}

function buildLastActivityAt(row: {
  lastSubmissionAt: Date | null
  lastApiUsageAt: Date | null
}): string | null {
  const lastTimestamp = Math.max(
    row.lastSubmissionAt?.getTime() ?? 0,
    row.lastApiUsageAt?.getTime() ?? 0
  )

  return lastTimestamp > 0 ? new Date(lastTimestamp).toISOString() : null
}

function compareSearchResults(
  left: McpTrackableSearchResult,
  right: McpTrackableSearchResult
): number {
  const scoreDelta = right.match.score - left.match.score
  if (scoreDelta !== 0) {
    return scoreDelta
  }

  const leftActivity = left.trackable.lastActivityAt
    ? Date.parse(left.trackable.lastActivityAt)
    : 0
  const rightActivity = right.trackable.lastActivityAt
    ? Date.parse(right.trackable.lastActivityAt)
    : 0
  const activityDelta = rightActivity - leftActivity
  if (activityDelta !== 0) {
    return activityDelta
  }

  const nameDelta = left.trackable.name.localeCompare(right.trackable.name)
  if (nameDelta !== 0) {
    return nameDelta
  }

  return left.workspace.name.localeCompare(right.workspace.name)
}

interface RankedMatch {
  kind: McpTrackableMatchKind
  score: number
}

export class McpTrackableService {
  constructor(private readonly deps: McpTrackableServiceDependencies) {}

  async listAccessible(
    authContext: McpAuthContext,
    options: McpTrackableListOptions
  ): Promise<McpTrackableItem[]> {
    const { workspaceMap, workspaceIds } = await this.resolveWorkspaceScope(
      authContext,
      options.workspaceId
    )

    const rows = await this.deps.listTrackableRows({
      workspaceIds,
      kind: options.kind,
      includeArchived: options.includeArchived ?? false,
    })

    return rows
      .filter((row) => this.isAuthorizedRow(row, authContext, workspaceMap))
      .map((row) => this.buildTrackableItem(row))
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  async findAccessible(
    authContext: McpAuthContext,
    options: McpTrackableFindOptions = {}
  ): Promise<McpTrackableFindResult> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 25)
    const normalizedQuery = normalizeSearchValue(options.query ?? "")
    const queryTokens = tokenizeSearchValue(normalizedQuery)

    const { workspaceMap, workspaceIds } = await this.resolveWorkspaceScope(
      authContext,
      options.workspaceId
    )

    const rows = await this.deps.listTrackableRows({
      workspaceIds,
      kind: options.kind,
      includeArchived: false,
      query: normalizedQuery || undefined,
      queryTokens,
    })

    const results = rows
      .filter((row) => this.isAuthorizedRow(row, authContext, workspaceMap))
      .map((row) =>
        this.buildSearchResult(row, workspaceMap, normalizedQuery, queryTokens)
      )
      .filter((result): result is McpTrackableSearchResult => result !== null)
      .sort(compareSearchResults)
      .slice(0, limit)

    return { results }
  }

  async assertAccess(
    trackableId: string,
    authContext: McpAuthContext
  ): Promise<McpTrackableRecord> {
    if (!authContext.canAccessTrackable(trackableId)) {
      throw new McpToolError(
        "SCOPE_ERROR",
        "This token does not have access to the requested trackable."
      )
    }

    const row = await this.deps.findTrackableById(trackableId)

    if (!row || row.archivedAt) {
      throw new McpToolError(
        "NOT_FOUND",
        "Trackable not found or is not accessible."
      )
    }

    if (!authContext.canAccessWorkspace(row.workspaceId)) {
      throw new McpToolError(
        "SCOPE_ERROR",
        "This token does not have access to the requested trackable's workspace."
      )
    }

    return row
  }

  async createTrackable(
    authContext: McpAuthContext,
    input: McpTrackableCreationInput
  ): Promise<McpTrackableCreationResult> {
    const workspaceId = await this.resolveDefaultWorkspaceId(
      authContext,
      input.workspaceId
    )

    if (!authContext.canAccessWorkspace(workspaceId)) {
      throw new McpToolError(
        "SCOPE_ERROR",
        "This token does not have access to the requested workspace."
      )
    }

    const existing = await this.deps.findTrackableByName(
      workspaceId,
      input.name
    )
    if (existing) {
      throw new ConflictError(
        `A trackable named "${input.name}" already exists in this workspace (id: ${existing.id}). Use find_trackables to locate it, or choose a different name.`
      )
    }

    let createdTrackable: McpTrackableMutationResult
    try {
      createdTrackable = await this.deps.createTrackable(authContext, {
        ...input,
        workspaceId,
      })
    } catch (error) {
      if (error instanceof Error) {
        throw translateServiceError(error)
      }
      throw error
    }

    return {
      id: createdTrackable.id,
      workspaceId: createdTrackable.workspaceId,
      kind: createdTrackable.kind,
      name: createdTrackable.name,
      slug: createdTrackable.slug,
      description: createdTrackable.description,
      adminUrl: this.deps.buildAdminUrl(createdTrackable.id),
    }
  }

  private async resolveWorkspaceScope(
    authContext: McpAuthContext,
    workspaceId?: string
  ): Promise<{
    workspaceIds: string[]
    workspaceMap: Map<string, McpWorkspaceSummary>
  }> {
    const workspaces = await this.deps.listAccessibleWorkspaces(authContext)
    const workspaceMap = new Map(
      workspaces.map((workspace) => [workspace.id, workspace])
    )
    const resolvedWorkspaceId = await this.resolveDefaultWorkspaceId(
      authContext,
      workspaceId,
      workspaces
    )

    const workspace = workspaceMap.get(resolvedWorkspaceId)
    if (!workspace) {
      throw new McpToolError(
        "SCOPE_ERROR",
        "This token does not have access to the requested workspace."
      )
    }

    return {
      workspaceIds: [workspace.id],
      workspaceMap,
    }
  }

  private async resolveDefaultWorkspaceId(
    authContext: McpAuthContext,
    workspaceId?: string,
    workspaces?: McpWorkspaceSummary[]
  ): Promise<string> {
    if (workspaceId) {
      return workspaceId
    }

    const accessibleWorkspaces =
      workspaces ?? (await this.deps.listAccessibleWorkspaces(authContext))
    const activeWorkspace = accessibleWorkspaces.find(
      (workspace) => workspace.isActive
    )

    if (!activeWorkspace) {
      throw new McpToolError(
        "SCOPE_ERROR",
        "This token does not have access to the user's active workspace."
      )
    }

    return activeWorkspace.id
  }

  private isAuthorizedRow(
    row: TrackableDiscoveryRow,
    authContext: McpAuthContext,
    workspaceMap: Map<string, McpWorkspaceSummary>
  ): boolean {
    return (
      workspaceMap.has(row.workspaceId) &&
      authContext.canAccessWorkspace(row.workspaceId) &&
      authContext.canAccessTrackable(row.id)
    )
  }

  private buildTrackableItem(row: TrackableDiscoveryRow): McpTrackableItem {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      slug: row.slug,
      kind: row.kind,
      submissionCount: row.submissionCount,
      apiUsageCount: row.apiUsageCount,
      lastActivityAt: buildLastActivityAt(row),
      adminUrl: this.deps.buildAdminUrl(row.id),
    }
  }

  private buildSearchResult(
    row: TrackableDiscoveryRow,
    workspaceMap: Map<string, McpWorkspaceSummary>,
    normalizedQuery: string,
    queryTokens: string[]
  ): McpTrackableSearchResult | null {
    const workspace = workspaceMap.get(row.workspaceId)
    if (!workspace) {
      return null
    }

    const trackable = this.buildTrackableItem(row)
    const match = this.rankTrackable(trackable, normalizedQuery, queryTokens)
    if (!match) {
      return null
    }

    return {
      trackable,
      workspace,
      match,
    }
  }

  private rankTrackable(
    trackable: Pick<McpTrackableItem, "name" | "slug">,
    normalizedQuery: string,
    queryTokens: string[]
  ): RankedMatch | null {
    if (!normalizedQuery) {
      return {
        kind: "recent",
        score: 0,
      }
    }

    const normalizedName = normalizeSearchValue(trackable.name)
    const normalizedSlug = normalizeSearchValue(trackable.slug)

    if (normalizedName === normalizedQuery) {
      return { kind: "exact_name", score: 1000 }
    }

    if (normalizedSlug === normalizedQuery) {
      return { kind: "exact_slug", score: 950 }
    }

    if (normalizedName.startsWith(normalizedQuery)) {
      return { kind: "prefix_name", score: 900 }
    }

    if (normalizedSlug.startsWith(normalizedQuery)) {
      return { kind: "prefix_slug", score: 850 }
    }

    if (normalizedName.includes(normalizedQuery)) {
      return { kind: "substring_name", score: 800 }
    }

    if (normalizedSlug.includes(normalizedQuery)) {
      return { kind: "substring_slug", score: 750 }
    }

    const tokenMatches = queryTokens.filter(
      (token) =>
        normalizedName.includes(token) || normalizedSlug.includes(token)
    ).length

    if (tokenMatches > 0) {
      return {
        kind: "token_overlap",
        score: 600 + tokenMatches,
      }
    }

    return null
  }
}
