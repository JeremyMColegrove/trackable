import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { z } from "zod"

import { McpAuthContextImpl } from "@/server/mcp/auth/mcp-auth-context"
import { McpToolError } from "@/server/mcp/errors/mcp-errors"
import { McpTrackableService } from "@/server/mcp/services/mcp-trackable.service-core"
import { FindTrackablesTool } from "@/server/mcp/tools/trackable-find.tool"

type AllowedTool =
  | "find_trackables"
  | "list_workspaces"
  | "list_trackables"
  | "search_logs"

type ToolList = "all" | AllowedTool[]

function createAuthContext(overrides?: {
  tools?: ToolList
  allowedWorkspaceIds?: string[]
  trackableIds?: string[]
  [key: string]: any
}) {
  return new McpAuthContextImpl({
    userId: "user-1",
    scopes: overrides?.tools === "all" ? ["*"] : (overrides?.tools ?? []),
    tools: overrides?.tools === "all" ? "all" : (overrides?.tools ?? "all"),
    workspaceIds: overrides?.allowedWorkspaceIds,
    trackableIds: overrides?.trackableIds,
  })
}

function createService(
  rows: Array<{
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
  }>
) {
  return new McpTrackableService({
    listAccessibleWorkspaces: async () => [workspaceAlpha, workspaceBeta],
    listTrackableRows: async ({ workspaceIds, trackableIds }) =>
      rows.filter((row) => {
        if (!workspaceIds.includes(row.workspaceId)) {
          return false
        }

        if (trackableIds && !trackableIds.includes(row.id)) {
          return false
        }

        return true
      }),
    findTrackableById: async () => undefined,
    findTrackableByName: async () => undefined,
    createTrackable: async () => {
      throw new Error("Not implemented in this test")
    },
    buildAdminUrl: (trackableId) =>
      `https://trackable.test/dashboard/trackables/${trackableId}`,
  })
}

function createFakeServer() {
  let registration:
    | {
        name: string
        config: { inputSchema: Record<string, z.ZodTypeAny> }
        handler: (args: Record<string, unknown>) => Promise<unknown>
      }
    | undefined

  return {
    server: {
      registerTool(
        name: string,
        config: { inputSchema: Record<string, z.ZodTypeAny> },
        handler: (args: Record<string, unknown>) => Promise<unknown>
      ) {
        registration = { name, config, handler }
      },
    },
    getRegistration() {
      assert.ok(registration, "Expected tool registration")
      return registration
    },
  }
}

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
  canCreateTrackables: false,
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

describe("McpTrackableService.findAccessible", () => {
  it("returns only rows from authorized workspaces", async () => {
    const service = createService([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        workspaceId: workspaceAlpha.id,
        name: "Alpha Survey",
        slug: "alpha-survey",
        kind: "survey",
        submissionCount: 2,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T10:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        workspaceId: workspaceGamma.id,
        name: "Hidden Survey",
        slug: "hidden-survey",
        kind: "survey",
        submissionCount: 1,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T11:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
    ])

    const result = await service.findAccessible(createAuthContext(), {
      query: "survey",
    })

    assert.equal(result.results.length, 1)
    assert.equal(result.results[0]?.workspace.id, workspaceAlpha.id)
  })

  it("enforces trackable ID whitelists", async () => {
    const allowedTrackableId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    const service = createService([
      {
        id: allowedTrackableId,
        workspaceId: workspaceAlpha.id,
        name: "Alpha Survey",
        slug: "alpha-survey",
        kind: "survey",
        submissionCount: 2,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T10:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        workspaceId: workspaceAlpha.id,
        name: "Beta Survey",
        slug: "beta-survey",
        kind: "survey",
        submissionCount: 3,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T11:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
    ])

    const result = await service.findAccessible(
      createAuthContext({ trackableIds: [allowedTrackableId] }),
      { query: "survey" }
    )

    assert.deepEqual(
      result.results.map((entry) => entry.trackable.id),
      [allowedTrackableId]
    )
  })

  it("rejects an unauthorized workspace filter", async () => {
    const service = createService([])

    await assert.rejects(
      () =>
        service.findAccessible(
          createAuthContext({ allowedWorkspaceIds: [workspaceAlpha.id] }),
          {
            workspaceId: workspaceGamma.id,
          }
        ),
      (error: unknown) => {
        assert.ok(error instanceof McpToolError)
        assert.equal(error.code, "SCOPE_ERROR")
        return true
      }
    )
  })

  it("ranks exact matches above prefix and substring matches", async () => {
    const service = createService([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        workspaceId: workspaceAlpha.id,
        name: "Alpha",
        slug: "alpha",
        kind: "survey",
        submissionCount: 5,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T09:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        workspaceId: workspaceAlpha.id,
        name: "Alpha Daily",
        slug: "alpha-daily",
        kind: "survey",
        submissionCount: 4,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T12:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        workspaceId: workspaceAlpha.id,
        name: "Project Alpha Tracker",
        slug: "project-alpha-tracker",
        kind: "survey",
        submissionCount: 6,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T15:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
    ])

    const result = await service.findAccessible(createAuthContext(), {
      query: "alpha",
    })

    assert.deepEqual(
      result.results.map((entry) => entry.match.kind),
      ["exact_name", "prefix_name", "substring_name"]
    )
  })

  it("honors the bounded result limit", async () => {
    const service = createService([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        workspaceId: workspaceAlpha.id,
        name: "Alpha One",
        slug: "alpha-one",
        kind: "survey",
        submissionCount: 1,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T09:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        workspaceId: workspaceAlpha.id,
        name: "Alpha Two",
        slug: "alpha-two",
        kind: "survey",
        submissionCount: 1,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T08:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        workspaceId: workspaceAlpha.id,
        name: "Alpha Three",
        slug: "alpha-three",
        kind: "survey",
        submissionCount: 1,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T07:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
    ])

    const result = await service.findAccessible(createAuthContext(), {
      query: "alpha",
      limit: 2,
    })

    assert.equal(result.results.length, 2)
  })

  it("includes trackable and workspace metadata for disambiguation", async () => {
    const service = createService([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        workspaceId: workspaceAlpha.id,
        name: "Alpha Survey",
        slug: "alpha-survey",
        kind: "survey",
        submissionCount: 2,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T10:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
    ])

    const result = await service.findAccessible(createAuthContext(), {
      query: "alpha",
    })

    const first = result.results[0]
    assert.ok(first)
    assert.equal(first.trackable.name, "Alpha Survey")
    assert.equal(first.trackable.adminUrl.includes(first.trackable.id), true)
    assert.equal(first.workspace.name, workspaceAlpha.name)
    assert.equal(typeof first.match.score, "number")
  })

  it("defaults omitted workspace filters to the active workspace", async () => {
    const service = createService([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        workspaceId: workspaceAlpha.id,
        name: "Alpha Survey",
        slug: "alpha-survey",
        kind: "survey",
        submissionCount: 2,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T10:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        workspaceId: workspaceBeta.id,
        name: "Alpha Beta Survey",
        slug: "alpha-beta-survey",
        kind: "survey",
        submissionCount: 4,
        apiUsageCount: 0,
        lastSubmissionAt: new Date("2026-04-01T11:00:00.000Z"),
        lastApiUsageAt: null,
        archivedAt: null,
      },
    ])

    const result = await service.findAccessible(createAuthContext(), {
      query: "alpha",
    })

    assert.deepEqual(
      result.results.map((entry) => entry.workspace.id),
      [workspaceAlpha.id]
    )
  })

  it("defaults trackable creation to the active workspace", async () => {
    let capturedWorkspaceId: string | undefined
    const service = new McpTrackableService({
      listAccessibleWorkspaces: async () => [workspaceAlpha, workspaceBeta],
      listTrackableRows: async () => [],
      findTrackableById: async () => undefined,
      findTrackableByName: async () => undefined,
      createTrackable: async (_authContext, input) => {
        const workspaceId = input.workspaceId ?? workspaceAlpha.id
        capturedWorkspaceId = workspaceId
        return {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          workspaceId,
          kind: input.kind,
          name: input.name,
          slug: "alpha-survey",
          description: input.description ?? null,
        }
      },
      buildAdminUrl: (trackableId) =>
        `https://trackable.test/dashboard/trackables/${trackableId}`,
    })

    const result = await service.createTrackable(createAuthContext(), {
      kind: "survey",
      name: "Alpha Survey",
    })

    assert.equal(capturedWorkspaceId, workspaceAlpha.id)
    assert.equal(result.workspaceId, workspaceAlpha.id)
  })
})

describe("FindTrackablesTool", () => {
  it("registers the expected input schema", () => {
    const { server, getRegistration } = createFakeServer()
    const tool = new FindTrackablesTool(
      {
        findAccessible: async () => ({ results: [] }),
      },
      { record: () => {} }
    )

    tool.register(server as never, createAuthContext())
    const registration = getRegistration()
    const schema = z.object(registration.config.inputSchema)

    assert.equal(registration.name, "find_trackables")
    assert.equal(
      schema.safeParse({
        query: "alpha",
        kind: "survey",
        workspace_id: workspaceAlpha.id,
        limit: 5,
      }).success,
      true
    )
    assert.equal(schema.safeParse({ query: "alpha", limit: 5 }).success, true)
    assert.equal(schema.safeParse({ limit: 26 }).success, false)
    assert.equal(
      schema.safeParse({ workspace_id: "not-a-uuid" }).success,
      false
    )
  })

  it("returns structured JSON results on success", async () => {
    const expected = {
      trackable: {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        workspaceId: workspaceAlpha.id,
        name: "Alpha Survey",
        slug: "alpha-survey",
        kind: "survey" as const,
        submissionCount: 2,
        apiUsageCount: 0,
        lastActivityAt: "2026-04-01T10:00:00.000Z",
        adminUrl:
          "https://trackable.test/dashboard/trackables/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      workspace: workspaceAlpha,
      match: {
        kind: "exact_name" as const,
        score: 1000,
      },
    }

    const { server, getRegistration } = createFakeServer()
    const tool = new FindTrackablesTool(
      {
        findAccessible: async () => ({ results: [expected] }),
      },
      { record: () => {} }
    )

    tool.register(server as never, createAuthContext())
    const response = (await getRegistration().handler({
      query: "alpha",
      limit: 1,
    })) as {
      content: Array<{ text: string }>
    }

    const parsed = JSON.parse(response.content[0]!.text)
    assert.deepEqual(parsed, { results: [expected] })
  })

  it("returns a structured scope error when permission is missing", async () => {
    let called = false
    const { server, getRegistration } = createFakeServer()
    const tool = new FindTrackablesTool(
      {
        findAccessible: async () => {
          called = true
          return { results: [] }
        },
      },
      { record: () => {} }
    )

    tool.register(
      server as never,
      createAuthContext({ tools: ["list_workspaces"] })
    )

    const response = (await getRegistration().handler({})) as {
      content: Array<{ text: string }>
    }
    const parsed = JSON.parse(response.content[0]!.text)

    assert.equal(called, false)
    assert.equal(parsed.error, true)
    assert.equal(parsed.code, "SCOPE_ERROR")
  })
})
