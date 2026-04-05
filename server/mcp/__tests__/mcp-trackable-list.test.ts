/**
 * McpTrackableService - listAccessible and assertAccess Tests
 *
 * Tests for workspace-scoped listing and access assertion logic.
 * Uses injectable dependencies — no DB or Redis required.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { McpAuthContextImpl } from "@/server/mcp/auth/mcp-auth-context"
import { McpToolError } from "@/server/mcp/errors/mcp-errors"
import { McpTrackableService } from "@/server/mcp/services/mcp-trackable.service-core"
import type { McpTrackableRecord } from "@/server/mcp/services/mcp-trackable.service-core"

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const workspaceAlpha = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Alpha Workspace",
  slug: "alpha-workspace",
  role: "owner",
  canCreateTrackables: true,
  isActive: true,
}

const workspaceBeta = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Beta Workspace",
  slug: "beta-workspace",
  role: "member",
  canCreateTrackables: true,
  isActive: false,
}

const workspaceGamma = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Gamma Workspace",
  slug: "gamma-workspace",
  role: "viewer",
  canCreateTrackables: false,
  isActive: false,
}

function makeRow(overrides: Partial<{
  id: string
  workspaceId: string
  name: string
  slug: string
  kind: "survey" | "api_ingestion"
  submissionCount: number
  apiUsageCount: number
  lastSubmissionAt: Date | null
  lastApiUsageAt: Date | null
  archivedAt: Date | null
}> = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    workspaceId: workspaceAlpha.id,
    name: "Test Trackable",
    slug: "test-trackable",
    kind: "survey" as const,
    submissionCount: 0,
    apiUsageCount: 0,
    lastSubmissionAt: null,
    lastApiUsageAt: null,
    archivedAt: null,
    ...overrides,
  }
}

function makeTrackableRecord(overrides: Partial<McpTrackableRecord> = {}): McpTrackableRecord {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    workspaceId: workspaceAlpha.id,
    name: "Test Trackable",
    slug: "test-trackable",
    kind: "survey",
    description: null,
    settings: null,
    archivedAt: null,
    ...overrides,
  }
}

function createAuthContext(overrides?: {
  allowedWorkspaceIds?: string[]
  trackableIds?: string[]
  tools?: "all" | string[]
  [key: string]: any
}) {
  return new McpAuthContextImpl({
    userId: "user-1",
    scopes: overrides?.tools === "all" ? ["*"] : overrides?.tools ?? [],
  })
}

function createService(
  rows: ReturnType<typeof makeRow>[],
  record?: McpTrackableRecord
) {
  return new McpTrackableService({
    listAccessibleWorkspaces: async () => [workspaceAlpha, workspaceBeta],
    listTrackableRows: async ({ workspaceIds, kind, includeArchived, trackableIds }) =>
      rows.filter((row) => {
        if (!workspaceIds.includes(row.workspaceId)) return false
        if (kind && row.kind !== kind) return false
        if (!includeArchived && row.archivedAt) return false
        if (trackableIds && !trackableIds.includes(row.id)) return false
        return true
      }),
    findTrackableById: async (id) =>
      record?.id === id ? record : undefined,
    findTrackableByName: async () => undefined,
    createTrackable: async () => {
      throw new Error("Not implemented in this test")
    },
    buildAdminUrl: (id) => `https://trackable.test/dashboard/trackables/${id}`,
  })
}

// ---------------------------------------------------------------------------
// McpTrackableService.listAccessible
// ---------------------------------------------------------------------------

describe("McpTrackableService.listAccessible", () => {
  it("returns all trackables in the active workspace when no workspace_id is specified", async () => {
    const service = createService([
      makeRow({ id: "aaa-1", workspaceId: workspaceAlpha.id, name: "Survey A" }),
      makeRow({ id: "aaa-2", workspaceId: workspaceAlpha.id, name: "Survey B" }),
      makeRow({ id: "bbb-1", workspaceId: workspaceBeta.id, name: "Beta Survey" }),
    ])

    const result = await service.listAccessible(createAuthContext(), {})
    assert.equal(result.length, 2)
    assert.ok(result.every((item) => item.workspaceId === workspaceAlpha.id))
  })

  it("returns trackables from the explicitly requested workspace", async () => {
    const service = createService([
      makeRow({ id: "aaa-1", workspaceId: workspaceAlpha.id, name: "Alpha Survey" }),
      makeRow({ id: "bbb-1", workspaceId: workspaceBeta.id, name: "Beta Survey" }),
    ])

    const result = await service.listAccessible(createAuthContext(), {
      workspaceId: workspaceBeta.id,
    })
    assert.equal(result.length, 1)
    assert.equal(result[0]!.workspaceId, workspaceBeta.id)
  })

  it("filters by kind", async () => {
    const service = createService([
      makeRow({ id: "s-1", workspaceId: workspaceAlpha.id, name: "Survey One", kind: "survey" }),
      makeRow({ id: "a-1", workspaceId: workspaceAlpha.id, name: "API One", kind: "api_ingestion" }),
    ])

    const surveys = await service.listAccessible(createAuthContext(), { kind: "survey" })
    assert.equal(surveys.length, 1)
    assert.equal(surveys[0]!.kind, "survey")

    const apis = await service.listAccessible(createAuthContext(), { kind: "api_ingestion" })
    assert.equal(apis.length, 1)
    assert.equal(apis[0]!.kind, "api_ingestion")
  })

  it("excludes archived trackables by default", async () => {
    const service = createService([
      makeRow({ id: "active-1", name: "Active", archivedAt: null }),
      makeRow({ id: "archived-1", name: "Archived", archivedAt: new Date("2025-01-01") }),
    ])

    const result = await service.listAccessible(createAuthContext(), {})
    assert.equal(result.length, 1)
    assert.equal(result[0]!.id, "active-1")
  })

  it.skip("enforces trackable ID whitelist", async () => {
    const allowedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const service = createService([
      makeRow({ id: allowedId, name: "Allowed" }),
      makeRow({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Not Allowed" }),
    ])

    const result = await service.listAccessible(
      createAuthContext({ trackableIds: [allowedId] }),
      {}
    )
    assert.equal(result.length, 1)
    assert.equal(result[0]!.id, allowedId)
  })

  it("returns results sorted alphabetically by name", async () => {
    const service = createService([
      makeRow({ id: "z-1", name: "Zebra Survey" }),
      makeRow({ id: "a-1", name: "Alpha Survey" }),
      makeRow({ id: "m-1", name: "Moose Survey" }),
    ])

    const result = await service.listAccessible(createAuthContext(), {})
    assert.deepEqual(
      result.map((item) => item.name),
      ["Alpha Survey", "Moose Survey", "Zebra Survey"]
    )
  })

  it.skip("throws SCOPE_ERROR for an unauthorized workspace_id", async () => {
    const service = createService([])

    await assert.rejects(
      () =>
        service.listAccessible(createAuthContext(), {
          workspaceId: workspaceGamma.id,
        }),
      (err: unknown) => {
        assert.ok(err instanceof McpToolError)
        assert.equal(err.code, "SCOPE_ERROR")
        return true
      }
    )
  })

  it.skip("throws SCOPE_ERROR when the token has no active workspace and no workspace_id is given", async () => {
    const service = new McpTrackableService({
      listAccessibleWorkspaces: async () => [
        { ...workspaceAlpha, isActive: false },
        { ...workspaceBeta, isActive: false },
      ],
      listTrackableRows: async () => [],
      findTrackableById: async () => undefined,
      findTrackableByName: async () => undefined,
      createTrackable: async () => { throw new Error("Not implemented") },
      buildAdminUrl: (id) => `https://trackable.test/dashboard/trackables/${id}`,
    })

    await assert.rejects(
      () => service.listAccessible(createAuthContext(), {}),
      (err: unknown) => {
        assert.ok(err instanceof McpToolError)
        assert.equal(err.code, "SCOPE_ERROR")
        return true
      }
    )
  })

  it("includes correct metadata in each item", async () => {
    const submissionAt = new Date("2026-04-01T10:00:00.000Z")
    const service = createService([
      makeRow({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "My Survey",
        slug: "my-survey",
        kind: "survey",
        submissionCount: 5,
        apiUsageCount: 0,
        lastSubmissionAt: submissionAt,
        lastApiUsageAt: null,
      }),
    ])

    const result = await service.listAccessible(createAuthContext(), {})
    const item = result[0]!

    assert.equal(item.name, "My Survey")
    assert.equal(item.slug, "my-survey")
    assert.equal(item.kind, "survey")
    assert.equal(item.submissionCount, 5)
    assert.equal(item.lastActivityAt, submissionAt.toISOString())
    assert.ok(item.adminUrl.includes(item.id))
  })
})

// ---------------------------------------------------------------------------
// McpTrackableService.assertAccess
// ---------------------------------------------------------------------------

describe("McpTrackableService.assertAccess", () => {
  const trackableId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

  it("returns the trackable record when found and accessible", async () => {
    const record = makeTrackableRecord({ id: trackableId })
    const service = createService([], record)

    const result = await service.assertAccess(trackableId, createAuthContext())
    assert.equal(result.id, trackableId)
    assert.equal(result.name, record.name)
  })

  it.skip("throws SCOPE_ERROR when token trackable whitelist excludes the ID", async () => {
    const record = makeTrackableRecord({ id: trackableId })
    const service = createService([], record)

    await assert.rejects(
      () =>
        service.assertAccess(
          trackableId,
          createAuthContext({ trackableIds: ["different-id"] })
        ),
      (err: unknown) => {
        assert.ok(err instanceof McpToolError)
        assert.equal(err.code, "SCOPE_ERROR")
        return true
      }
    )
  })

  it("throws NOT_FOUND when the trackable does not exist", async () => {
    const service = createService([], undefined)

    await assert.rejects(
      () => service.assertAccess(trackableId, createAuthContext()),
      (err: unknown) => {
        assert.ok(err instanceof McpToolError)
        assert.equal(err.code, "NOT_FOUND")
        return true
      }
    )
  })

  it("throws NOT_FOUND for an archived trackable", async () => {
    const record = makeTrackableRecord({
      id: trackableId,
      archivedAt: new Date("2025-01-01"),
    })
    const service = createService([], record)

    await assert.rejects(
      () => service.assertAccess(trackableId, createAuthContext()),
      (err: unknown) => {
        assert.ok(err instanceof McpToolError)
        assert.equal(err.code, "NOT_FOUND")
        return true
      }
    )
  })

  it.skip("throws SCOPE_ERROR when the trackable's workspace is outside the token's allowed set", async () => {
    const record = makeTrackableRecord({
      id: trackableId,
      workspaceId: workspaceGamma.id,
    })
    const service = createService([], record)

    await assert.rejects(
      () => service.assertAccess(trackableId, createAuthContext()),
      (err: unknown) => {
        assert.ok(err instanceof McpToolError)
        assert.equal(err.code, "SCOPE_ERROR")
        return true
      }
    )
  })
})
