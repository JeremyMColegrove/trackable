/**
 * MCP Form Schema and Validation
 *
 * Defines the strict Zod schema for MCP form creation payloads and the
 * deterministic validation function used by McpFormService.
 *
 * This file has no server-only dependencies so it can be imported in tests
 * and shared edge contexts without restriction.
 *
 * Important exclusions (intentional):
 * - file_upload fields: no file upload mechanism via MCP
 * - youtube_video fields: display-only, not agent-creatable
 */

import { z } from "zod"

import type { McpValidationError } from "@/server/mcp/errors/mcp-errors"
import { zodPathToString } from "@/server/mcp/errors/mcp-errors"
import { ratingConfigSchema } from "@/lib/form-schemas"

// ---------------------------------------------------------------------------
// Field config schemas
// ---------------------------------------------------------------------------

// Rating config is identical to the shared schema; import it directly.
const mcpRatingConfigSchema = ratingConfigSchema

const mcpCheckboxOptionSchema = z.object({
  label: z.string().trim().min(1, "option label must not be empty").max(80),
  value: z
    .string()
    .trim()
    .min(1, "option value must not be empty")
    .max(80)
    .regex(
      /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
      "option value must use lowercase letters, numbers, and underscores"
    ),
})

const mcpCheckboxesConfigSchema = z
  .object({
    kind: z.literal("checkboxes"),
    options: z
      .array(mcpCheckboxOptionSchema)
      .min(1, "checkboxes must have at least one option"),
    allowOther: z.boolean().optional(),
    minSelections: z.number().int().min(0).optional(),
    maxSelections: z.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      typeof value.minSelections === "number" &&
      typeof value.maxSelections === "number" &&
      value.minSelections > value.maxSelections
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSelections"],
        message: "maxSelections must be >= minSelections",
      })
    }
    const optionLimit = value.options.length + (value.allowOther ? 1 : 0)
    if (
      typeof value.maxSelections === "number" &&
      value.maxSelections > optionLimit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSelections"],
        message: "maxSelections cannot exceed the number of available choices",
      })
    }
  })

const mcpNotesConfigSchema = z.object({
  kind: z.literal("notes"),
  placeholder: z.string().trim().max(160).optional(),
  maxLength: z
    .number()
    .int()
    .min(1, "maxLength must be at least 1")
    .max(5000, "maxLength must be at most 5000")
    .optional(),
})

const mcpShortTextConfigSchema = z.object({
  kind: z.literal("short_text"),
  placeholder: z.string().trim().max(160).optional(),
  maxLength: z
    .number()
    .int()
    .min(1, "maxLength must be at least 1")
    .max(500, "maxLength must be at most 500")
    .optional(),
})

/**
 * Discriminated union of supported field configs.
 * file_upload and youtube_video are intentionally excluded —
 * they cannot be created via MCP (no file upload mechanism, display-only).
 */
const mcpFieldConfigSchema = z.discriminatedUnion("kind", [
  mcpRatingConfigSchema,
  mcpCheckboxesConfigSchema,
  mcpNotesConfigSchema,
  mcpShortTextConfigSchema,
])

// ---------------------------------------------------------------------------
// Form field schema
// ---------------------------------------------------------------------------

export const mcpFormFieldSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, "key must not be empty")
      .max(64, "key must be at most 64 characters")
      .regex(
        /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
        "key must use lowercase letters, numbers, and underscores only (e.g. rating_1)"
      ),
    kind: z.enum(["rating", "checkboxes", "notes", "short_text"], {
      error: (issue) => {
        if (issue.input !== undefined) {
          return {
            message: `"${issue.input}" is not a supported field type. Supported types: rating, checkboxes, notes, short_text. Note: file_upload and youtube_video are not supported for MCP form creation.`,
          }
        }
        return {
          message: "kind is required and must be a supported field type",
        }
      },
    }),
    label: z
      .string()
      .trim()
      .min(1, "label must not be empty")
      .max(120, "label must be at most 120 characters"),
    description: z.string().trim().max(280).optional(),
    required: z.boolean({
      error: () => ({ message: "required must be a boolean (true or false)" }),
    }),
    config: mcpFieldConfigSchema,
  })
  .superRefine((field, ctx) => {
    if (field.kind !== field.config.kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["config", "kind"],
        message: `config.kind must match field kind: expected "${field.kind}", got "${field.config.kind}"`,
      })
    }
  })

// ---------------------------------------------------------------------------
// Top-level form schema
// ---------------------------------------------------------------------------

export const mcpFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "title must not be empty")
      .max(120, "title must be at most 120 characters"),
    description: z.string().trim().max(280).optional(),
    status: z.enum(["draft", "published"], {
      error: () => ({
        message: 'status must be "draft" or "published"',
      }),
    }),
    submit_label: z.string().trim().max(60).optional(),
    success_message: z.string().trim().max(280).optional(),
    fields: z
      .array(mcpFormFieldSchema)
      .min(1, "fields must contain at least one field"),
  })
  .superRefine((form, ctx) => {
    if (form.status === "published" && form.fields.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields"],
        message: "A published form must contain at least one field.",
      })
    }

    const seenKeys = new Set<string>()
    for (let i = 0; i < form.fields.length; i++) {
      const field = form.fields[i]
      if (!field) continue
      if (seenKeys.has(field.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", i, "key"],
          message: `Field key "${field.key}" must be unique within the form.`,
        })
      }
      seenKeys.add(field.key)
    }
  })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type McpFormInput = z.infer<typeof mcpFormSchema>

/** Discriminated success/failure result from validateFormPayload. */
export type McpFormValidationResult =
  | { valid: true; data: McpFormInput }
  | { valid: false; errors: McpValidationError[] }

// ---------------------------------------------------------------------------
// Validation function
// ---------------------------------------------------------------------------

/**
 * Validates a raw (untrusted) payload against the MCP form schema.
 *
 * Returns either a validated `McpFormInput` or a list of structured errors
 * with exact paths, received values, and expected types.
 *
 * No database writes occur — this is pure validation, safe to call anywhere.
 */
export function validateMcpFormPayload(
  payload: unknown
): McpFormValidationResult {
  const result = mcpFormSchema.safeParse(payload)

  if (result.success) {
    return { valid: true, data: result.data }
  }

  // Map Zod issues to structured McpValidationError[]
  const errors: McpValidationError[] = result.error.issues.map((issue) => {
    const path = zodPathToString(issue.path as (string | number)[])
    return {
      path: path || "(root)",
      issue: issue.message,
      // Zod v4 attaches the received value to some issue types (e.g. invalid_type)
      received: (issue as unknown as Record<string, unknown>).received,
      expected: deriveExpectedDescription(issue),
    }
  })

  return { valid: false, errors }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Derives a human-readable "expected" string from a Zod v4 issue. */
function deriveExpectedDescription(issue: z.ZodIssue): string {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return `${issue.expected} (received ${(issue as unknown as { received?: string }).received ?? "unknown"})`
    case z.ZodIssueCode.too_small:
      return `value >= ${issue.minimum}`
    case z.ZodIssueCode.too_big:
      return `value <= ${issue.maximum}`
    case z.ZodIssueCode.invalid_value:
      // Zod v4: invalid_value replaces v3's invalid_enum_value
      return `one of the allowed values`
    case z.ZodIssueCode.invalid_format:
      // Zod v4: invalid_format replaces v3's invalid_string
      return `valid format`
    default:
      return "valid value"
  }
}
