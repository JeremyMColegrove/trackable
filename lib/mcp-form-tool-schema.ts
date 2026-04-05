import { z } from "zod"

const toolRatingConfigSchema = z.object({
  kind: z.literal("rating").describe('Must be "rating".'),
  scale: z
    .coerce
    .number()
    .int()
    .min(3)
    .max(10)
    .describe(
      "Number of rating choices. Integer from 3 to 10 — strings like \"5\" are accepted. Use 5 for a standard 1-5 rating."
    ),
  icon: z
    .enum(["star", "thumb", "heart"])
    .optional()
    .describe("Optional rating icon style."),
  labels: z
    .object({
      low: z
        .string()
        .max(80)
        .optional()
        .describe('Optional label for the low end, such as "Poor".'),
      high: z
        .string()
        .max(80)
        .optional()
        .describe('Optional label for the high end, such as "Excellent".'),
    })
    .optional()
    .describe("Optional text labels for the low and high ends of the scale."),
})

const toolCheckboxOptionSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(80)
    .describe("Display label shown to responders."),
  value: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
    .describe(
      'Stored option value using lowercase letters, numbers, and underscores, for example "option_a".'
    ),
})

const toolCheckboxesConfigSchema = z.object({
  kind: z.literal("checkboxes").describe('Must be "checkboxes".'),
  options: z
    .array(toolCheckboxOptionSchema)
    .min(1)
    .describe(
      "Available checkbox options. At least one option is required. Each option must include label and value. Do not provide an id; the server generates option ids automatically."
    ),
  allowOther: z
    .boolean()
    .optional()
    .describe("Whether responders can enter an additional free-form option."),
  minSelections: z
    .coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Optional minimum number of selected options. Strings like \"1\" are accepted."),
  maxSelections: z
    .coerce
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Optional maximum number of selected options. Strings like \"3\" are accepted."),
})

const toolNotesConfigSchema = z.object({
  kind: z.literal("notes").describe('Must be "notes".'),
  placeholder: z
    .string()
    .max(160)
    .optional()
    .describe("Optional placeholder text shown in the textarea."),
  maxLength: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe("Optional maximum character count, from 1 to 5000. Strings like \"500\" are accepted."),
})

const toolShortTextConfigSchema = z.object({
  kind: z.literal("short_text").describe('Must be "short_text".'),
  placeholder: z
    .string()
    .max(160)
    .optional()
    .describe("Optional placeholder text shown in the input."),
  maxLength: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Optional maximum character count, from 1 to 500. Strings like \"200\" are accepted."),
})

export const mcpToolFieldConfigSchema = z
  .discriminatedUnion("kind", [
    toolRatingConfigSchema,
    toolCheckboxesConfigSchema,
    toolNotesConfigSchema,
    toolShortTextConfigSchema,
  ])
  .describe(
    'Field-type-specific configuration. Use the branch that matches the field kind. Required shapes: rating requires scale; checkboxes requires options with label and value; notes supports optional placeholder and maxLength; short_text supports optional placeholder and maxLength.'
  )

export const mcpCreateFormToolInputSchema = {
  trackable_id: z
    .string()
    .uuid("trackable_id must be a valid UUID")
    .describe("UUID of an existing survey-kind trackable to create the form on."),
  form: z
    .object({
      title: z
        .string()
        .min(1)
        .max(120)
        .describe("Form title (1–120 characters)."),
      description: z
        .string()
        .max(280)
        .optional()
        .describe("Optional description shown below the title (max 280 characters)."),
      status: z
        .enum(["draft", "published"])
        .optional()
        .default("draft")
        .describe(
          'Optional. "draft" saves without publishing (default). "published" makes the form immediately live. A published form must have at least one field.'
        ),
      submit_label: z
        .string()
        .max(60)
        .optional()
        .describe(
          "Custom label for the submit button (max 60 characters). Default: Submit response."
        ),
      success_message: z
        .string()
        .max(280)
        .optional()
        .describe("Message shown to responders after submitting (max 280 characters)."),
      fields: z
        .array(
          z.object({
            key: z
              .string()
              .min(1)
              .max(64)
              .describe(
                'Unique field identifier using lowercase letters, numbers, and underscores (e.g. "rating_1", "feedback_text"). Must be unique within the form.'
              ),
            kind: z
              .enum(["rating", "checkboxes", "notes", "short_text"])
              .describe(
                "Field type. Must match the config.kind. Supported: rating, checkboxes, notes, short_text."
              ),
            label: z
              .string()
              .min(1)
              .max(120)
              .describe("Display label shown above the field."),
            description: z
              .string()
              .max(280)
              .optional()
              .describe("Optional help text shown below the label."),
            required: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether this field must be filled before submission. Defaults to false if omitted."),
            config: mcpToolFieldConfigSchema,
          })
        )
        .min(1)
        .describe(
          "Array of form fields. At least one field is required. Every field must include key, kind, label, required, and config."
        ),
    })
    .describe("The form definition to create."),
}
