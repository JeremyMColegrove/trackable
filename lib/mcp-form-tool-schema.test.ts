import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { z } from "zod"

import { mcpCreateFormToolInputSchema } from "@/lib/mcp-form-tool-schema"

describe("mcpCreateFormToolInputSchema", () => {
  it("uses a discriminated union for field config with typed rating constraints", () => {
    const formSchema =
      mcpCreateFormToolInputSchema.form as z.ZodObject<z.ZodRawShape>
    const fieldsSchema = formSchema.shape.fields as z.ZodArray<z.ZodType>
    const fieldSchema = fieldsSchema.element as z.ZodObject<z.ZodRawShape>
    const configSchema = fieldSchema.shape.config as z.ZodType

    assert.ok(
      configSchema instanceof z.ZodDiscriminatedUnion,
      "expected field config to be a discriminated union"
    )

    assert.equal(
      configSchema.safeParse({ kind: "rating", scale: 5, icon: "star" })
        .success,
      true
    )
    assert.equal(
      configSchema.safeParse({ kind: "rating", scale: "5" }).success,
      true,
      "string scale should be coerced to number"
    )
    assert.equal(configSchema.safeParse({ kind: "rating" }).success, false)
  })

  it("documents checkbox options without requiring agent-supplied ids", () => {
    const formSchema =
      mcpCreateFormToolInputSchema.form as z.ZodObject<z.ZodRawShape>
    const fieldsSchema = formSchema.shape.fields as z.ZodArray<z.ZodType>
    const fieldSchema = fieldsSchema.element as z.ZodObject<z.ZodRawShape>
    const configSchema = fieldSchema.shape.config as z.ZodType

    assert.equal(
      configSchema.safeParse({
        kind: "checkboxes",
        options: [{ label: "Fast response", value: "fast_response" }],
      }).success,
      true
    )
  })
})
