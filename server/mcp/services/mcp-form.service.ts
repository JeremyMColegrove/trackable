import "server-only"

import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { trackableItems } from "@/db/schema"
import type { FormFieldConfig } from "@/db/schema/types"
import { buildAbsoluteUrl } from "@/lib/site-config"
import {
  validateMcpFormPayload,
  type McpFormInput,
  type McpFormValidationResult,
} from "@/lib/mcp-form-schema"
import { formService } from "@/server/services/form.service"
import type { McpAuthContext } from "@/server/mcp/auth/mcp-auth-context"
import { McpToolError } from "@/server/mcp/errors/mcp-errors"
import type { McpValidationError } from "@/server/mcp/errors/mcp-errors"
import { mcpTrackableService } from "@/server/mcp/services/mcp-trackable.service"
import type { EditableTrackableForm } from "@/lib/project-form-builder"

// Re-export types for callers that import from this module
export type { McpFormInput, McpFormValidationResult }

/** A single field in the form definition returned by get_form. */
export interface McpFormField {
  key: string
  kind: string
  label: string
  description: string | null
  required: boolean
  config: FormFieldConfig
}

/** Result returned by the get_form tool. */
export interface McpFormDetail {
  hasForm: true
  formId: string
  trackableId: string
  version: number
  title: string
  description: string | null
  status: string
  submitLabel: string | null
  successMessage: string | null
  fieldCount: number
  fields: McpFormField[]
  uiLink: string
}

export interface McpFormDetailEmpty {
  hasForm: false
  trackableId: string
  message: string
}

/** Result returned to the create_form tool handler. */
export interface McpFormCreationResult {
  success: boolean
  formId?: string
  trackableId?: string
  formVersion?: number
  title?: string
  status?: string
  /** Structured errors for retry when success is false */
  errorCode?: string
  message?: string
  errors?: McpValidationError[]
}

/**
 * MCP Form Service
 *
 * Implements strict JSON-driven form creation for the create_form tool.
 *
 * Validation is deterministic and runs before any database write.
 * If validation fails, the caller receives structured path-level errors
 * suitable for agent self-correction and retry. If validation succeeds,
 * the form is created via the existing formService.saveForm().
 * Sharing state is managed separately via the update_form_sharing tool.
 *
 * The pure validation function lives in `lib/mcp-form-schema.ts` so it can
 * be tested without importing server-only modules.
 */
export class McpFormService {
  private toEditableFieldConfig(
    config: McpFormInput["fields"][number]["config"]
  ): EditableTrackableForm["fields"][number]["config"] {
    if (config.kind !== "checkboxes") {
      return config as EditableTrackableForm["fields"][number]["config"]
    }

    return {
      ...config,
      options: config.options.map((option) => ({
        ...option,
        id: randomUUID(),
      })),
    }
  }

  /**
   * Returns the current active form definition for a survey trackable.
   *
   * Returns McpFormDetailEmpty when the trackable exists but has no form yet.
   * Throws McpToolError for non-survey trackables or access failures.
   */
  async getForm(
    trackableId: string,
    authContext: McpAuthContext
  ): Promise<McpFormDetail | McpFormDetailEmpty> {
    const trackable = await mcpTrackableService.assertAccess(
      trackableId,
      authContext
    )

    if (trackable.kind !== "survey") {
      throw new McpToolError(
        "FORBIDDEN",
        `Trackable "${trackable.name}" is of kind "${trackable.kind}". Only survey trackables have forms.`
      )
    }

    const record = await db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, trackableId),
      columns: { id: true },
      with: {
        activeForm: {
          with: { fields: true },
        },
      },
    })

    if (!record?.activeForm) {
      return {
        hasForm: false,
        trackableId,
        message:
          "This trackable has no form yet. Use create_form to add one.",
      }
    }

    const form = record.activeForm
    const fields = [...form.fields]
      .sort((a, b) => a.position - b.position)
      .map((field) => ({
        key: field.key,
        kind: field.kind,
        label: field.label,
        description: field.description,
        required: field.required,
        config: field.config as FormFieldConfig,
      }))

    return {
      hasForm: true,
      formId: form.id,
      trackableId,
      version: form.version,
      title: form.title,
      description: form.description,
      status: form.status,
      submitLabel: form.submitLabel,
      successMessage: form.successMessage,
      fieldCount: fields.length,
      fields,
      uiLink: buildAbsoluteUrl(
        `/dashboard/trackables/${trackableId}`
      ).toString(),
    }
  }

  /**
   * Validates a raw (untrusted) payload against the MCP form schema.
   *
   * Delegates to `validateMcpFormPayload` from lib/mcp-form-schema.ts.
   * No database writes occur on validation failure.
   */
  validateFormPayload(payload: unknown): McpFormValidationResult {
    return validateMcpFormPayload(payload)
  }

  /**
   * Creates a form on an existing survey trackable from a validated MCP payload.
   *
   * Steps:
   * 1. Validate the payload — fail immediately with structured errors if invalid
   * 2. Verify the trackable exists, is a survey, and is accessible
   * 3. Transform the payload into EditableTrackableForm (assigning IDs/positions)
   * 4. Persist via formService.saveForm()
   * 5. Return success with form identifiers and deep links
   */
  async createFormFromPayload(
    trackableId: string,
    rawPayload: unknown,
    authContext: McpAuthContext
  ): Promise<McpFormCreationResult> {
    // Step 1: Validate before touching the database
    const validation = this.validateFormPayload(rawPayload)
    if (!validation.valid) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        message:
          "Form payload validation failed. Fix the listed errors and retry.",
        errors: validation.errors,
      }
    }

    const formInput = validation.data

    // Step 2: Verify trackable access and kind
    const trackable = await mcpTrackableService.assertAccess(
      trackableId,
      authContext
    )

    if (trackable.kind !== "survey") {
      throw new McpToolError(
        "FORBIDDEN",
        `Trackable "${trackable.name}" is of kind "${trackable.kind}". Only survey trackables can have forms.`
      )
    }

    // Step 3: Transform to EditableTrackableForm (assign UUIDs and positions)
    const editableForm: EditableTrackableForm = {
      title: formInput.title,
      description: formInput.description ?? null,
      status: formInput.status,
      submitLabel: formInput.submit_label ?? null,
      successMessage: formInput.success_message ?? null,
      fields: formInput.fields.map((field, index) => ({
        id: randomUUID(),
        key: field.key,
        kind: field.kind,
        label: field.label,
        description: field.description ?? null,
        required: field.required,
        position: index,
        config: this.toEditableFieldConfig(field.config),
      })),
    }

    // Step 4: Persist via the existing form service
    const savedForm = await formService.saveForm(
      trackableId,
      authContext.userId,
      editableForm
    )

    return {
      success: true,
      formId: savedForm.id,
      trackableId,
      formVersion: savedForm.version,
      title: savedForm.title,
      status: savedForm.status,
    }
  }
}

export const mcpFormService = new McpFormService()
