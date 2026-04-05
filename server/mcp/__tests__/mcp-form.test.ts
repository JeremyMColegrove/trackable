/**
 * MCP Form Validation Tests
 *
 * Tests for the strict JSON-driven form creation validation layer.
 * These do not require a running database — they only exercise the
 * McpFormService.validateFormPayload() method which is pure Zod validation.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

// Import the pure schema validation from lib/ (no server-only dependency)
import { validateMcpFormPayload as validate } from "../../../lib/mcp-form-schema"

// Wrap in a thin object to mirror the service API used in tests
const mcpFormService = { validateFormPayload: validate }

// ---------------------------------------------------------------------------
// Helper: build a minimal valid form payload
// ---------------------------------------------------------------------------

function validFormPayload() {
  return {
    title: "Customer Feedback Survey",
    status: "draft" as const,
    fields: [
      {
        key: "rating_1",
        kind: "rating" as const,
        label: "How did we do?",
        required: true,
        config: {
          kind: "rating" as const,
          scale: 5,
          icon: "star" as const,
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Success cases
// ---------------------------------------------------------------------------

describe("McpFormService.validateFormPayload", () => {
  describe("valid payloads", () => {
    it("accepts a minimal valid payload with one rating field", () => {
      const result = mcpFormService.validateFormPayload(validFormPayload())
      assert.equal(result.valid, true)
    })

    it("accepts a payload with multiple field types", () => {
      const payload = {
        title: "Full Survey",
        description: "Please fill this out.",
        status: "published",
        submit_label: "Send",
        success_message: "Thank you!",
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "Rating",
            required: true,
            config: { kind: "rating", scale: 5 },
          },
          {
            key: "feedback_notes",
            kind: "notes",
            label: "Notes",
            required: false,
            config: { kind: "notes", maxLength: 1000 },
          },
          {
            key: "short_answer",
            kind: "short_text",
            label: "Short answer",
            required: false,
            config: { kind: "short_text", maxLength: 200 },
          },
          {
            key: "categories",
            kind: "checkboxes",
            label: "Categories",
            required: false,
            config: {
              kind: "checkboxes",
              options: [
                {
                  label: "Option A",
                  value: "option_a",
                },
              ],
            },
          },
        ],
      }

      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, true)
    })

    it("accepts a published form with at least one field", () => {
      const result = mcpFormService.validateFormPayload({
        ...validFormPayload(),
        status: "published",
      })
      assert.equal(result.valid, true)
    })
  })

  // ---------------------------------------------------------------------------
  // Failure: missing required top-level fields
  // ---------------------------------------------------------------------------

  describe("missing required fields", () => {
    it("fails when title is missing", () => {
      const payload = {
        status: "draft",
        fields: [validFormPayload().fields[0]],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
      assert.ok(
        !result.valid && result.errors.some((e) => e.path.includes("title")),
        "Expected error on 'title' path"
      )
    })

    it("fails when status is missing", () => {
      const payload = { title: "Test", fields: [validFormPayload().fields[0]] }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
      assert.ok(
        !result.valid && result.errors.some((e) => e.path.includes("status"))
      )
    })

    it("fails when fields array is empty", () => {
      const payload = { title: "Test", status: "draft", fields: [] }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
      assert.ok(
        !result.valid && result.errors.some((e) => e.path.includes("fields"))
      )
    })

    it("fails when fields is missing entirely", () => {
      const payload = { title: "Test", status: "draft" }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })
  })

  // ---------------------------------------------------------------------------
  // Failure: unsupported field types
  // ---------------------------------------------------------------------------

  describe("unsupported field types", () => {
    it("fails when kind is 'file_upload' (not supported via MCP)", () => {
      const payload = {
        title: "Test",
        status: "draft",
        fields: [
          {
            key: "upload_1",
            kind: "file_upload",
            label: "Upload your file",
            required: false,
            config: { kind: "file_upload", asset: null },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
      assert.ok(
        !result.valid &&
          result.errors.some(
            (e) =>
              e.path.includes("kind") ||
              e.issue.toLowerCase().includes("file_upload")
          ),
        "Expected error about unsupported field type"
      )
    })

    it("fails when kind is 'youtube_video' (not supported via MCP)", () => {
      const payload = {
        title: "Test",
        status: "draft",
        fields: [
          {
            key: "video_1",
            kind: "youtube_video",
            label: "Watch this",
            required: false,
            config: {
              kind: "youtube_video",
              url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })

    it("fails when kind is completely unknown", () => {
      const payload = {
        title: "Test",
        status: "draft",
        fields: [
          {
            key: "mystery_1",
            kind: "magic_field",
            label: "Mystery",
            required: false,
            config: { kind: "magic_field" },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })
  })

  // ---------------------------------------------------------------------------
  // Failure: invalid rating config
  // ---------------------------------------------------------------------------

  describe("invalid rating config", () => {
    it("fails when scale is below minimum (3)", () => {
      const payload = {
        ...validFormPayload(),
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "Rating",
            required: true,
            config: { kind: "rating", scale: 1 },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
      assert.ok(
        !result.valid &&
          result.errors.some(
            (e) => e.path.includes("scale") || e.issue.includes("3")
          ),
        `Expected scale validation error, got: ${JSON.stringify(result)}`
      )
    })

    it("fails when scale exceeds maximum (10)", () => {
      const payload = {
        ...validFormPayload(),
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "Rating",
            required: true,
            config: { kind: "rating", scale: 15 },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })

    it("fails when icon is not a valid enum value", () => {
      const payload = {
        ...validFormPayload(),
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "Rating",
            required: true,
            config: { kind: "rating", scale: 5, icon: "diamond" },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })
  })

  // ---------------------------------------------------------------------------
  // Failure: invalid checkboxes config
  // ---------------------------------------------------------------------------

  describe("invalid checkboxes config", () => {
    it("fails when options array is empty", () => {
      const payload = {
        ...validFormPayload(),
        fields: [
          {
            key: "check_1",
            kind: "checkboxes",
            label: "Choose",
            required: false,
            config: { kind: "checkboxes", options: [] },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })

    it("accepts checkbox options without ids because the server generates them", () => {
      const payload = {
        ...validFormPayload(),
        fields: [
          {
            key: "check_1",
            kind: "checkboxes",
            label: "Choose",
            required: false,
            config: {
              kind: "checkboxes",
              options: [{ label: "A", value: "a" }],
            },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, true)
    })

    it("fails when minSelections > maxSelections", () => {
      const payload = {
        ...validFormPayload(),
        fields: [
          {
            key: "check_1",
            kind: "checkboxes",
            label: "Choose",
            required: false,
            config: {
              kind: "checkboxes",
              options: [
                {
                  label: "A",
                  value: "a",
                },
              ],
              minSelections: 3,
              maxSelections: 1,
            },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })
  })

  // ---------------------------------------------------------------------------
  // Failure: duplicate field keys
  // ---------------------------------------------------------------------------

  describe("duplicate field keys", () => {
    it("fails when two fields share the same key", () => {
      const payload = {
        title: "Test",
        status: "draft",
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "First rating",
            required: true,
            config: { kind: "rating", scale: 5 },
          },
          {
            key: "rating_1", // duplicate!
            kind: "rating",
            label: "Second rating",
            required: false,
            config: { kind: "rating", scale: 3 },
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
      assert.ok(
        !result.valid &&
          result.errors.some((e) => e.issue.includes("rating_1")),
        `Expected duplicate key error mentioning 'rating_1', got: ${JSON.stringify(!result.valid ? result.errors : [])}`
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Failure: config.kind mismatch
  // ---------------------------------------------------------------------------

  describe("config.kind mismatch", () => {
    it("fails when config.kind does not match field kind", () => {
      const payload = {
        title: "Test",
        status: "draft",
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "Rating",
            required: true,
            config: { kind: "notes" }, // mismatch!
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })
  })

  // ---------------------------------------------------------------------------
  // Failure: published form with no fields
  // ---------------------------------------------------------------------------

  describe("published form constraints", () => {
    it("fails when status is 'published' but fields array is empty", () => {
      const payload = {
        title: "Empty published form",
        status: "published",
        fields: [],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)
    })
  })

  // ---------------------------------------------------------------------------
  // Error structure validation
  // ---------------------------------------------------------------------------

  describe("error response structure", () => {
    it("returns errors with path, issue, and expected fields", () => {
      const payload = { status: "draft", fields: [] }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)

      if (!result.valid) {
        for (const error of result.errors) {
          assert.ok(
            typeof error.path === "string",
            "error.path must be a string"
          )
          assert.ok(
            typeof error.issue === "string",
            "error.issue must be a string"
          )
          assert.ok(
            typeof error.expected === "string",
            "error.expected must be a string"
          )
        }
      }
    })

    it("identifies the specific failing path in nested field config", () => {
      const payload = {
        title: "Test",
        status: "draft",
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "Rating",
            required: true,
            config: { kind: "rating", scale: 99 }, // invalid scale
          },
        ],
      }
      const result = mcpFormService.validateFormPayload(payload)
      assert.equal(result.valid, false)

      if (!result.valid) {
        const scaleError = result.errors.find((e) => e.path.includes("scale"))
        assert.ok(
          scaleError,
          "Should have a specific error on the 'scale' path"
        )
        assert.ok(
          scaleError.path.startsWith("fields[0]"),
          `Path should start with 'fields[0]', got '${scaleError.path}'`
        )
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Retry loop: fix payload and succeed
  // ---------------------------------------------------------------------------

  describe("agent retry loop", () => {
    it("fails with invalid scale, then succeeds after correction", () => {
      // Step 1: Submit invalid payload
      const badPayload = {
        title: "Retry Survey",
        status: "draft",
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "Rating",
            required: true,
            config: { kind: "rating", scale: 0 }, // invalid
          },
        ],
      }
      const failResult = mcpFormService.validateFormPayload(badPayload)
      assert.equal(failResult.valid, false)
      assert.ok(!failResult.valid && failResult.errors.length > 0)

      // Step 2: Fix the payload based on the error
      const goodPayload = {
        ...badPayload,
        fields: [
          {
            key: "rating_1",
            kind: "rating",
            label: "Rating",
            required: true,
            config: { kind: "rating", scale: 5 }, // fixed
          },
        ],
      }
      const successResult = mcpFormService.validateFormPayload(goodPayload)
      assert.equal(successResult.valid, true)
    })

    it("fails with unsupported kind, then succeeds with supported kind", () => {
      const badPayload = {
        title: "Survey",
        status: "draft",
        fields: [
          {
            key: "upload_1",
            kind: "file_upload", // not supported
            label: "Upload",
            required: false,
            config: { kind: "file_upload", asset: null },
          },
        ],
      }
      const failResult = mcpFormService.validateFormPayload(badPayload)
      assert.equal(failResult.valid, false)

      const goodPayload = {
        title: "Survey",
        status: "draft",
        fields: [
          {
            key: "notes_1",
            kind: "notes", // supported
            label: "Notes",
            required: false,
            config: { kind: "notes", maxLength: 500 },
          },
        ],
      }
      const successResult = mcpFormService.validateFormPayload(goodPayload)
      assert.equal(successResult.valid, true)
    })
  })
})
