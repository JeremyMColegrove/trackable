import "server-only"
import { TRPCError } from "@trpc/server"
import { eq, max } from "drizzle-orm"
import { db } from "@/db"
import { trackableFormFields, trackableForms, trackableItems } from "@/db/schema"
import { normalizeEditableForm, type EditableTrackableForm } from "@/lib/project-form-builder"
import { accessControlService } from "@/server/services/access-control.service"
import { sharedFormCache } from "@/server/redis/shared-form-cache.repository"
import { assertTrackableKind } from "@/server/services/trackable-kind"

export class FormService {
  async createForm(trackableId: string, userId: string) {
    const trackable = await accessControlService.assertTrackableAccess(
      trackableId,
      userId,
      "manage"
    )

    const trackableRecord = await db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, trackable.id),
      columns: {
        id: true,
        kind: true,
        name: true,
        description: true,
      },
    })

    if (!trackableRecord) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    assertTrackableKind(
      trackableRecord.kind,
      "survey",
      "Only survey trackables can build forms."
    )

    const form = await db.transaction(async (tx) => {
      const [versionResult] = await tx
        .select({
          maxVersion: max(trackableForms.version),
        })
        .from(trackableForms)
        .where(eq(trackableForms.trackableId, trackableRecord.id))

      const nextVersion = (versionResult?.maxVersion ?? 0) + 1

      const [createdForm] = await tx
        .insert(trackableForms)
        .values({
          trackableId: trackableRecord.id,
          version: nextVersion,
          title: `${trackableRecord.name} feedback form`,
          description:
            trackableRecord.description ??
            "Fill out the form below and submit your response.",
          status: "draft",
          submitLabel: "Submit response",
          successMessage: "Thanks for your response.",
        })
        .returning()

      await tx
        .update(trackableItems)
        .set({
          activeFormId: createdForm.id,
        })
        .where(eq(trackableItems.id, trackableRecord.id))

      return createdForm
    })

    await sharedFormCache.invalidateForTrackable(trackable.id)

    return {
      id: form.id,
      version: form.version,
      title: form.title,
      description: form.description,
      status: form.status,
      submitLabel: form.submitLabel,
      successMessage: form.successMessage,
      fields: [],
    }
  }

  async saveForm(trackableId: string, userId: string, rawFormInput: EditableTrackableForm) {
    const trackable = await accessControlService.assertTrackableAccess(
      trackableId,
      userId,
      "manage"
    )

    assertTrackableKind(
      trackable.kind,
      "survey",
      "Only survey trackables can save forms."
    )

    const normalizedForm = normalizeEditableForm(rawFormInput)

    const savedForm = await db.transaction(async (tx) => {
      const [versionResult] = await tx
        .select({
          maxVersion: max(trackableForms.version),
        })
        .from(trackableForms)
        .where(eq(trackableForms.trackableId, trackable.id))

      const nextVersion = (versionResult?.maxVersion ?? 0) + 1

      const [createdForm] = await tx
        .insert(trackableForms)
        .values({
          trackableId: trackable.id,
          version: nextVersion,
          title: normalizedForm.title,
          description: normalizedForm.description,
          status: normalizedForm.status,
          submitLabel: normalizedForm.submitLabel,
          successMessage: normalizedForm.successMessage,
        })
        .returning()

      await tx
        .update(trackableItems)
        .set({
          activeFormId: createdForm.id,
        })
        .where(eq(trackableItems.id, trackable.id))

      if (normalizedForm.fields.length > 0) {
        const createdFields = await tx
          .insert(trackableFormFields)
          .values(
            normalizedForm.fields.map((field, index) => ({
              formId: createdForm.id,
              key: field.key,
              kind: field.kind,
              label: field.label,
              description: field.description ?? null,
              required: field.required,
              position: index,
              config: field.config,
            }))
          )
          .returning()

        return {
          id: createdForm.id,
          version: createdForm.version,
          title: createdForm.title,
          description: createdForm.description,
          status: createdForm.status,
          submitLabel: createdForm.submitLabel,
          successMessage: createdForm.successMessage,
          fields: createdFields
            .sort((left, right) => left.position - right.position)
            .map((field) => ({
              id: field.id,
              key: field.key,
              kind: field.kind,
              label: field.label,
              description: field.description,
              required: field.required,
              position: field.position,
              config: field.config,
            })),
        }
      }

      return {
        id: createdForm.id,
        version: createdForm.version,
        title: createdForm.title,
        description: createdForm.description,
        status: createdForm.status,
        submitLabel: createdForm.submitLabel,
        successMessage: createdForm.successMessage,
        fields: [],
      }
    })

    await sharedFormCache.invalidateForTrackable(trackable.id)

    return savedForm
  }

  async getPreview(trackableId: string, userId: string) {
    const trackable = await accessControlService.assertTrackableAccess(
      trackableId,
      userId,
      "manage"
    )

    assertTrackableKind(
      trackable.kind,
      "survey",
      "Only survey trackables can preview forms."
    )

    const trackableRecord = await db.query.trackableItems.findFirst({
      where: eq(trackableItems.id, trackable.id),
      columns: {
        id: true,
        name: true,
        description: true,
      },
      with: {
        activeForm: {
          with: {
            fields: true,
          },
        },
      },
    })

    if (!trackableRecord) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable not found.",
      })
    }

    return {
      trackable: {
        id: trackableRecord.id,
        name: trackableRecord.name,
        description: trackableRecord.description,
      },
      form: trackableRecord.activeForm
        ? {
            id: trackableRecord.activeForm.id,
            version: trackableRecord.activeForm.version,
            title: trackableRecord.activeForm.title,
            description: trackableRecord.activeForm.description,
            status: trackableRecord.activeForm.status,
            submitLabel: trackableRecord.activeForm.submitLabel,
            successMessage: trackableRecord.activeForm.successMessage,
            fields: [...trackableRecord.activeForm.fields].sort(
              (left, right) => left.position - right.position
            ),
          }
        : null,
    }
  }
}

export const formService = new FormService()
