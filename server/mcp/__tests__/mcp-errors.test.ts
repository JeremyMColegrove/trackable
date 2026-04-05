/**
 * MCP Error Tests
 *
 * Tests for the error classes, content builders, and path conversion utilities.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  McpAuthError,
  McpToolError,
  buildMcpErrorContent,
  zodPathToString,
} from "../errors/mcp-errors"

// ---------------------------------------------------------------------------
// zodPathToString
// ---------------------------------------------------------------------------

describe("zodPathToString", () => {
  it("converts a flat string path", () => {
    assert.equal(zodPathToString(["title"]), "title")
  })

  it("converts a nested path", () => {
    assert.equal(
      zodPathToString(["fields", 0, "config", "scale"]),
      "fields[0].config.scale"
    )
  })

  it("converts an empty path to an empty string", () => {
    assert.equal(zodPathToString([]), "")
  })

  it("converts a path starting with an array index", () => {
    assert.equal(zodPathToString([0, "key"]), "[0].key")
  })
})

// ---------------------------------------------------------------------------
// McpToolError
// ---------------------------------------------------------------------------

describe("McpToolError", () => {
  it("carries code, message, and optional details", () => {
    const err = new McpToolError("NOT_FOUND", "Resource not found.", {
      id: "123",
    })
    assert.equal(err.code, "NOT_FOUND")
    assert.equal(err.message, "Resource not found.")
    assert.deepEqual(err.details, { id: "123" })
    assert.equal(err.name, "McpToolError")
  })

  it("details is undefined when not provided", () => {
    const err = new McpToolError("FORBIDDEN", "Access denied.")
    assert.equal(err.details, undefined)
  })

  it("is an instance of Error", () => {
    assert.ok(new McpToolError("INTERNAL_ERROR", "Oops.") instanceof Error)
  })
})

// ---------------------------------------------------------------------------
// buildMcpErrorContent
// ---------------------------------------------------------------------------

describe("buildMcpErrorContent", () => {
  it("maps McpAuthError to a structured JSON envelope", () => {
    const error = new McpAuthError("UNAUTHORIZED", "Token expired.")
    const content = buildMcpErrorContent(error)
    const parsed = JSON.parse(content)
    assert.equal(parsed.error, true)
    assert.equal(parsed.code, "UNAUTHORIZED")
    assert.equal(parsed.message, "Token expired.")
    assert.equal(parsed.details, undefined)
  })

  it("maps McpToolError to a structured JSON envelope with details", () => {
    const error = new McpToolError("VALIDATION_ERROR", "Invalid payload.", {
      errors: [{ path: "title", issue: "Required", expected: "string" }],
    })
    const content = buildMcpErrorContent(error)
    const parsed = JSON.parse(content)
    assert.equal(parsed.error, true)
    assert.equal(parsed.code, "VALIDATION_ERROR")
    assert.ok(Array.isArray(parsed.details.errors))
  })

  it("maps unknown errors to INTERNAL_ERROR with a generic message", () => {
    const error = new Error("Raw database error with sensitive details")
    const content = buildMcpErrorContent(error)
    const parsed = JSON.parse(content)
    assert.equal(parsed.error, true)
    assert.equal(parsed.code, "INTERNAL_ERROR")
    // Must NOT leak the raw error message
    assert.ok(
      !parsed.message.includes("database"),
      "Internal error message must not leak raw details"
    )
  })

  it("maps non-Error thrown values to INTERNAL_ERROR", () => {
    const content = buildMcpErrorContent("string error")
    const parsed = JSON.parse(content)
    assert.equal(parsed.error, true)
    assert.equal(parsed.code, "INTERNAL_ERROR")
  })
})
