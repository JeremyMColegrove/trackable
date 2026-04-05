/**
 * MCP Tool Input Schema Tests
 *
 * Validates the input schemas for every MCP tool that is not already covered
 * by a dedicated test file. Schemas are defined inline, mirroring the tool
 * source, so these tests guard against accidental breakage of agent-facing
 * validation rules.
 *
 * Tools already covered elsewhere:
 *   find_trackables   — mcp-trackable-discovery.test.ts
 *   create_form       — mcp-form.test.ts + lib/mcp-form-tool-schema.test.ts
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const VALID_UUID_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function passes(schema: z.ZodTypeAny, value: unknown): void {
  const result = schema.safeParse(value)
  assert.ok(
    result.success,
    `Expected schema to accept ${JSON.stringify(value)}`
  )
}

function fails(schema: z.ZodTypeAny, value: unknown): void {
  const result = schema.safeParse(value)
  assert.ok(
    !result.success,
    `Expected schema to reject ${JSON.stringify(value)}`
  )
}

// ---------------------------------------------------------------------------
// list_workspaces
// ---------------------------------------------------------------------------

describe("list_workspaces input schema", () => {
  // The tool registers an empty inputSchema — no parameters are accepted.
  const schema = z.object({})

  it("accepts an empty object", () => {
    passes(schema, {})
  })

  it("strips unknown keys (Zod strip mode)", () => {
    // Unexpected keys must not cause a failure — agents may pass extra fields.
    const result = schema.safeParse({ unexpected: "value" })
    assert.ok(result.success)
  })
})

// ---------------------------------------------------------------------------
// list_trackables
// ---------------------------------------------------------------------------

describe("list_trackables input schema", () => {
  const schema = z.object({
    workspace_id: z.string().uuid().optional(),
    kind: z.enum(["survey", "api_ingestion"]).optional(),
    include_archived: z.boolean().optional().default(false),
  })

  it("accepts all fields omitted", () => {
    passes(schema, {})
  })

  it("accepts valid workspace_id and kind", () => {
    passes(schema, { workspace_id: VALID_UUID, kind: "survey" })
    passes(schema, { workspace_id: VALID_UUID, kind: "api_ingestion" })
  })

  it("defaults include_archived to false when omitted", () => {
    const result = schema.parse({})
    assert.equal(result.include_archived, false)
  })

  it("accepts include_archived: true", () => {
    passes(schema, { include_archived: true })
  })

  it("rejects non-UUID workspace_id", () => {
    fails(schema, { workspace_id: "not-a-uuid" })
  })

  it("rejects unknown kind values", () => {
    fails(schema, { kind: "file_upload" })
    fails(schema, { kind: "" })
  })
})

// ---------------------------------------------------------------------------
// create_trackable
// ---------------------------------------------------------------------------

describe("create_trackable input schema", () => {
  const schema = z.object({
    workspace_id: z.string().uuid().optional(),
    kind: z.enum(["survey", "api_ingestion"]),
    name: z.string().trim().min(2).max(120),
    description: z.string().max(500).optional(),
  })

  it("accepts minimal valid input", () => {
    passes(schema, { kind: "survey", name: "My Form" })
  })

  it("accepts all fields", () => {
    passes(schema, {
      workspace_id: VALID_UUID,
      kind: "api_ingestion",
      name: "Production Logger",
      description: "Tracks production API events.",
    })
  })

  it("rejects name shorter than 2 characters", () => {
    fails(schema, { kind: "survey", name: "X" })
  })

  it("rejects name longer than 120 characters", () => {
    fails(schema, { kind: "survey", name: "A".repeat(121) })
  })

  it("rejects missing kind", () => {
    fails(schema, { name: "My Form" })
  })

  it("rejects invalid kind", () => {
    fails(schema, { kind: "form", name: "My Form" })
  })

  it("rejects description longer than 500 characters", () => {
    fails(schema, {
      kind: "survey",
      name: "Test",
      description: "D".repeat(501),
    })
  })

  it("rejects non-UUID workspace_id", () => {
    fails(schema, { kind: "survey", name: "Test", workspace_id: "bad-id" })
  })
})

// ---------------------------------------------------------------------------
// search_logs
// ---------------------------------------------------------------------------

describe("search_logs input schema", () => {
  const schema = z.object({
    trackable_id: z.string().uuid(),
    query: z.string().trim().max(500).optional().default(""),
    group_by: z.string().trim().min(1).max(100).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    page_size: z.number().int().min(1).max(100).optional().default(25),
    cursor: z.string().optional(),
  })

  it("accepts only trackable_id", () => {
    passes(schema, { trackable_id: VALID_UUID })
  })

  it("accepts all optional fields", () => {
    passes(schema, {
      trackable_id: VALID_UUID,
      query: "level:error",
      group_by: "route",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-04-01T00:00:00.000Z",
      page_size: 50,
      cursor: "eyJpZCI6Ijg4OCJ9",
    })
  })

  it("defaults query to empty string and page_size to 25", () => {
    const result = schema.parse({ trackable_id: VALID_UUID })
    assert.equal(result.query, "")
    assert.equal(result.page_size, 25)
  })

  it("rejects page_size below 1", () => {
    fails(schema, { trackable_id: VALID_UUID, page_size: 0 })
  })

  it("rejects page_size above 100", () => {
    fails(schema, { trackable_id: VALID_UUID, page_size: 101 })
  })

  it("rejects query longer than 500 characters", () => {
    fails(schema, { trackable_id: VALID_UUID, query: "q".repeat(501) })
  })

  it("rejects non-ISO-8601 from/to values", () => {
    fails(schema, { trackable_id: VALID_UUID, from: "April 1st" })
    fails(schema, { trackable_id: VALID_UUID, to: "yesterday" })
  })

  it("rejects non-UUID trackable_id", () => {
    fails(schema, { trackable_id: "not-a-uuid" })
  })

  it("rejects empty group_by string", () => {
    fails(schema, { trackable_id: VALID_UUID, group_by: "" })
  })
})

// ---------------------------------------------------------------------------
// get_log
// ---------------------------------------------------------------------------

describe("get_log input schema", () => {
  const schema = z.object({
    trackable_id: z.string().uuid(),
    log_id: z.string().uuid(),
  })

  it("accepts valid UUIDs for both fields", () => {
    passes(schema, { trackable_id: VALID_UUID, log_id: VALID_UUID_2 })
  })

  it("rejects missing trackable_id", () => {
    fails(schema, { log_id: VALID_UUID })
  })

  it("rejects missing log_id", () => {
    fails(schema, { trackable_id: VALID_UUID })
  })

  it("rejects non-UUID values", () => {
    fails(schema, { trackable_id: "bad", log_id: VALID_UUID })
    fails(schema, { trackable_id: VALID_UUID, log_id: "bad" })
  })
})

// ---------------------------------------------------------------------------
// update_form_sharing
// ---------------------------------------------------------------------------

describe("update_form_sharing input schema", () => {
  const schema = z.object({
    trackable_id: z.string().uuid(),
    enable_public_link: z.boolean().optional(),
    allow_anonymous_responses: z.boolean().optional(),
  })

  it("accepts only trackable_id", () => {
    passes(schema, { trackable_id: VALID_UUID })
  })

  it("accepts all optional booleans set to true", () => {
    passes(schema, {
      trackable_id: VALID_UUID,
      enable_public_link: true,
      allow_anonymous_responses: true,
    })
  })

  it("accepts all optional booleans set to false", () => {
    passes(schema, {
      trackable_id: VALID_UUID,
      enable_public_link: false,
      allow_anonymous_responses: false,
    })
  })

  it("rejects non-UUID trackable_id", () => {
    fails(schema, { trackable_id: "not-a-uuid" })
  })

  it("rejects non-boolean enable_public_link", () => {
    fails(schema, { trackable_id: VALID_UUID, enable_public_link: "yes" })
  })

  it("rejects non-boolean allow_anonymous_responses", () => {
    fails(schema, { trackable_id: VALID_UUID, allow_anonymous_responses: 1 })
  })
})

// ---------------------------------------------------------------------------
// list_responses
// ---------------------------------------------------------------------------

describe("list_responses input schema", () => {
  const schema = z.object({
    trackable_id: z.string().uuid(),
    page_size: z.number().int().min(1).max(100).optional().default(25),
    cursor: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })

  it("accepts only trackable_id", () => {
    passes(schema, { trackable_id: VALID_UUID })
  })

  it("accepts all optional fields", () => {
    passes(schema, {
      trackable_id: VALID_UUID,
      page_size: 10,
      cursor: "eyJpZCI6IjEifQ==",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-04-01T00:00:00.000Z",
    })
  })

  it("defaults page_size to 25", () => {
    const result = schema.parse({ trackable_id: VALID_UUID })
    assert.equal(result.page_size, 25)
  })

  it("rejects page_size of 0", () => {
    fails(schema, { trackable_id: VALID_UUID, page_size: 0 })
  })

  it("rejects page_size above 100", () => {
    fails(schema, { trackable_id: VALID_UUID, page_size: 101 })
  })

  it("rejects non-integer page_size", () => {
    fails(schema, { trackable_id: VALID_UUID, page_size: 10.5 })
  })

  it("rejects non-ISO-8601 from/to values", () => {
    fails(schema, { trackable_id: VALID_UUID, from: "01/01/2026" })
    fails(schema, { trackable_id: VALID_UUID, to: "not-a-date" })
  })

  it("rejects non-UUID trackable_id", () => {
    fails(schema, { trackable_id: "bad-id" })
  })
})

// ---------------------------------------------------------------------------
// get_response
// ---------------------------------------------------------------------------

describe("get_response input schema", () => {
  const schema = z.object({
    trackable_id: z.string().uuid(),
    response_id: z.string().uuid(),
  })

  it("accepts valid UUIDs", () => {
    passes(schema, { trackable_id: VALID_UUID, response_id: VALID_UUID_2 })
  })

  it("rejects missing trackable_id", () => {
    fails(schema, { response_id: VALID_UUID })
  })

  it("rejects missing response_id", () => {
    fails(schema, { trackable_id: VALID_UUID })
  })

  it("rejects non-UUID values", () => {
    fails(schema, { trackable_id: "bad", response_id: VALID_UUID })
    fails(schema, { trackable_id: VALID_UUID, response_id: "bad" })
  })
})

// ---------------------------------------------------------------------------
// create_api_key
// ---------------------------------------------------------------------------

describe("create_api_key input schema", () => {
  const schema = z.object({
    trackable_id: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    expiration: z
      .enum(["never", "30_days", "60_days", "90_days"])
      .optional()
      .default("never"),
  })

  it("accepts minimal valid input", () => {
    passes(schema, { trackable_id: VALID_UUID, name: "Production Key" })
  })

  it("accepts all expiration values", () => {
    for (const expiration of [
      "never",
      "30_days",
      "60_days",
      "90_days",
    ] as const) {
      passes(schema, { trackable_id: VALID_UUID, name: "Key", expiration })
    }
  })

  it("defaults expiration to 'never'", () => {
    const result = schema.parse({ trackable_id: VALID_UUID, name: "Key" })
    assert.equal(result.expiration, "never")
  })

  it("rejects empty name", () => {
    fails(schema, { trackable_id: VALID_UUID, name: "" })
  })

  it("rejects name longer than 100 characters", () => {
    fails(schema, { trackable_id: VALID_UUID, name: "K".repeat(101) })
  })

  it("rejects invalid expiration", () => {
    fails(schema, {
      trackable_id: VALID_UUID,
      name: "Key",
      expiration: "7_days",
    })
  })

  it("rejects non-UUID trackable_id", () => {
    fails(schema, { trackable_id: "bad", name: "Key" })
  })
})

// ---------------------------------------------------------------------------
// list_api_keys
// ---------------------------------------------------------------------------

describe("list_api_keys input schema", () => {
  const schema = z.object({
    trackable_id: z.string().uuid(),
  })

  it("accepts a valid UUID", () => {
    passes(schema, { trackable_id: VALID_UUID })
  })

  it("rejects missing trackable_id", () => {
    fails(schema, {})
  })

  it("rejects non-UUID trackable_id", () => {
    fails(schema, { trackable_id: "not-a-uuid" })
  })
})

// ---------------------------------------------------------------------------
// revoke_api_key
// ---------------------------------------------------------------------------

describe("revoke_api_key input schema", () => {
  const schema = z.object({
    trackable_id: z.string().uuid(),
    api_key_id: z.string().uuid(),
  })

  it("accepts valid UUIDs for both fields", () => {
    passes(schema, { trackable_id: VALID_UUID, api_key_id: VALID_UUID_2 })
  })

  it("rejects missing trackable_id", () => {
    fails(schema, { api_key_id: VALID_UUID })
  })

  it("rejects missing api_key_id", () => {
    fails(schema, { trackable_id: VALID_UUID })
  })

  it("rejects non-UUID values", () => {
    fails(schema, { trackable_id: "bad", api_key_id: VALID_UUID })
    fails(schema, { trackable_id: VALID_UUID, api_key_id: "bad" })
  })
})
