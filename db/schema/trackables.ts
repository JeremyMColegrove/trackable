import { relations, sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import {
  archivedAt,
  createdAt,
  createdByUserId,
  expiresAt,
  metadataJson,
  nullableTimestamp,
  revokedAt,
  settingsJson,
  sortOrder,
  submissionCount,
  timestamps,
  usageCount,
  uuidPrimaryKey,
} from "@/db/schema/_shared"
import {
  trackableAccessRoleEnum,
  trackableAssetKindEnum,
  trackableAccessSubjectTypeEnum,
  trackableFormFieldKindEnum,
  trackableFormStatusEnum,
  trackableKindEnum,
  trackableSubmissionSourceEnum,
} from "@/db/schema/enums"
import { workspaces } from "@/db/schema/team"
import { trackableWebhookConnections } from "@/db/schema/webhooks"
import type {
  FormAnswerValue,
  FormFieldConfig,
  SubmissionMetadata,
  TrackableAssetKind,
  TrackableKind,
  TrackableSubmissionSnapshot,
  TrackableSettings,
} from "@/db/schema/types"
import { users } from "@/db/schema/users"

export const trackableItems = pgTable(
  "trackable_items",
  {
    id: uuidPrimaryKey(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    kind: trackableKindEnum().$type<TrackableKind>().notNull(),
    activeFormId: uuid().references(
      (): AnyPgColumn => trackableForms.id,
      {
        onDelete: "set null",
      }
    ),
    settings: settingsJson<TrackableSettings>(),
    submissionCount: submissionCount(),
    apiUsageCount: usageCount(),
    lastSubmissionAt: nullableTimestamp(),
    lastApiUsageAt: nullableTimestamp(),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trackable_items_workspace_slug_idx").on(
      table.workspaceId,
      table.slug
    ),
    index("trackable_items_workspace_idx").on(table.workspaceId),
  ]
)

export const trackableAccessGrants = pgTable(
  "trackable_access_grants",
  {
    id: uuidPrimaryKey(),
    trackableId: uuid()
      .notNull()
      .references((): AnyPgColumn => trackableItems.id, {
        onDelete: "cascade",
      }),
    subjectType: trackableAccessSubjectTypeEnum().notNull(),
    subjectUserId: text().references(() => users.id, {
      onDelete: "cascade",
    }),
    subjectEmail: text(),
    role: trackableAccessRoleEnum().default("submit").notNull(),
    createdByUserId: createdByUserId().references(() => users.id, {
      onDelete: "cascade",
    }),
    acceptedAt: nullableTimestamp(),
    revokedAt: revokedAt(),
    ...timestamps,
  },
  (table) => [
    index("trackable_access_grants_trackable_idx").on(table.trackableId),
    uniqueIndex("trackable_access_grants_trackable_user_idx")
      .on(table.trackableId, table.subjectUserId)
      .where(sql`${table.subjectUserId} is not null`),
    uniqueIndex("trackable_access_grants_trackable_email_idx")
      .on(table.trackableId, table.subjectEmail)
      .where(sql`${table.subjectEmail} is not null`),
    check(
      "trackable_access_grants_subject_check",
      sql`(
        ${table.subjectType} = 'user'
        and ${table.subjectUserId} is not null
        and ${table.subjectEmail} is null
      ) or (
        ${table.subjectType} = 'email'
        and ${table.subjectUserId} is null
        and ${table.subjectEmail} is not null
      )`
    ),
  ]
)

export const trackableShareLinks = pgTable(
  "trackable_share_links",
  {
    id: uuidPrimaryKey(),
    trackableId: uuid()
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    token: text().notNull(),
    role: trackableAccessRoleEnum().default("submit").notNull(),
    expiresAt: expiresAt(),
    revokedAt: revokedAt(),
    createdByUserId: createdByUserId().references(() => users.id, {
      onDelete: "cascade",
    }),
    lastUsedAt: nullableTimestamp(),
    usageCount: usageCount(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trackable_share_links_token_idx").on(table.token),
    index("trackable_share_links_trackable_idx").on(table.trackableId),
  ]
)

export const trackableForms = pgTable(
  "trackable_forms",
  {
    id: uuidPrimaryKey(),
    trackableId: uuid()
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    title: text().notNull(),
    description: text(),
    status: trackableFormStatusEnum().default("draft").notNull(),
    submitLabel: text(),
    successMessage: text(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trackable_forms_trackable_version_idx").on(
      table.trackableId,
      table.version
    ),
    index("trackable_forms_trackable_idx").on(table.trackableId),
  ]
)

export const trackableAssets = pgTable(
  "trackable_assets",
  {
    id: uuidPrimaryKey(),
    trackableId: uuid()
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    uploadedByUserId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicToken: text().notNull(),
    kind: trackableAssetKindEnum().$type<TrackableAssetKind>().notNull(),
    originalFileName: text().notNull(),
    mimeType: text().notNull(),
    extension: text().notNull(),
    originalBytes: integer().notNull(),
    storedBytes: integer().notNull(),
    storageKey: text().notNull(),
    imageWidth: integer(),
    imageHeight: integer(),
    imageFormat: text(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trackable_assets_public_token_idx").on(table.publicToken),
    uniqueIndex("trackable_assets_storage_key_idx").on(table.storageKey),
    index("trackable_assets_trackable_idx").on(table.trackableId),
    index("trackable_assets_uploaded_by_idx").on(table.uploadedByUserId),
    index("trackable_assets_created_at_idx").on(table.createdAt),
  ]
)

export const trackableFormFields = pgTable(
  "trackable_form_fields",
  {
    id: uuidPrimaryKey(),
    formId: uuid()
      .notNull()
      .references(() => trackableForms.id, { onDelete: "cascade" }),
    key: text().notNull(),
    kind: trackableFormFieldKindEnum().notNull(),
    label: text().notNull(),
    description: text(),
    required: boolean().default(false).notNull(),
    position: sortOrder(),
    config: jsonb().$type<FormFieldConfig>().notNull(),
    isArchived: boolean().default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trackable_form_fields_form_key_idx").on(
      table.formId,
      table.key
    ),
    uniqueIndex("trackable_form_fields_form_position_idx").on(
      table.formId,
      table.position
    ),
    index("trackable_form_fields_form_idx").on(table.formId),
  ]
)

export const trackableFormSubmissions = pgTable(
  "trackable_form_submissions",
  {
    id: uuidPrimaryKey(),
    trackableId: uuid()
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    formId: uuid()
      .notNull()
      .references(() => trackableForms.id, { onDelete: "cascade" }),
    shareLinkId: uuid().references(
      () => trackableShareLinks.id,
      { onDelete: "set null" }
    ),
    submittedByUserId: text().references(() => users.id, {
      onDelete: "set null",
    }),
    submittedEmail: text(),
    source: trackableSubmissionSourceEnum().notNull(),
    submissionSnapshot: jsonb()
      .$type<TrackableSubmissionSnapshot>()
      .notNull(),
    metadata: metadataJson<SubmissionMetadata>(),
    createdAt: createdAt(),
  },
  (table) => [
    index("trackable_form_submissions_trackable_idx").on(table.trackableId),
    index("trackable_form_submissions_form_idx").on(table.formId),
    index("trackable_form_submissions_created_at_idx").on(table.createdAt),
  ]
)

export const trackableItemsRelations = relations(
  trackableItems,
  ({ many, one }) => ({
    workspace: one(workspaces, {
      fields: [trackableItems.workspaceId],
      references: [workspaces.id],
    }),
    activeForm: one(trackableForms, {
      fields: [trackableItems.activeFormId],
      references: [trackableForms.id],
      relationName: "trackableActiveForm",
    }),
    accessGrants: many(trackableAccessGrants),
    shareLinks: many(trackableShareLinks),
    forms: many(trackableForms),
    assets: many(trackableAssets),
    submissions: many(trackableFormSubmissions),
    webhookConnections: many(trackableWebhookConnections),
  })
)

export const trackableFormAnswers = pgTable(
  "trackable_form_answers",
  {
    id: uuidPrimaryKey(),
    submissionId: uuid()
      .notNull()
      .references(() => trackableFormSubmissions.id, { onDelete: "cascade" }),
    fieldId: uuid()
      .notNull()
      .references(() => trackableFormFields.id, { onDelete: "cascade" }),
    value: jsonb().$type<FormAnswerValue>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("trackable_form_answers_submission_field_idx").on(
      table.submissionId,
      table.fieldId
    ),
    index("trackable_form_answers_submission_idx").on(table.submissionId),
  ]
)

export const trackableAccessGrantsRelations = relations(
  trackableAccessGrants,
  ({ one }) => ({
    trackable: one(trackableItems, {
      fields: [trackableAccessGrants.trackableId],
      references: [trackableItems.id],
    }),
    subjectUser: one(users, {
      relationName: "trackableAccessGrantSubjectUser",
      fields: [trackableAccessGrants.subjectUserId],
      references: [users.id],
    }),
    createdByUser: one(users, {
      relationName: "trackableAccessGrantCreatedByUser",
      fields: [trackableAccessGrants.createdByUserId],
      references: [users.id],
    }),
  })
)

export const trackableShareLinksRelations = relations(
  trackableShareLinks,
  ({ many, one }) => ({
    trackable: one(trackableItems, {
      fields: [trackableShareLinks.trackableId],
      references: [trackableItems.id],
    }),
    createdByUser: one(users, {
      fields: [trackableShareLinks.createdByUserId],
      references: [users.id],
    }),
    submissions: many(trackableFormSubmissions),
  })
)

export const trackableFormsRelations = relations(
  trackableForms,
  ({ many, one }) => ({
    trackable: one(trackableItems, {
      fields: [trackableForms.trackableId],
      references: [trackableItems.id],
    }),
    fields: many(trackableFormFields),
    submissions: many(trackableFormSubmissions),
  })
)

export const trackableAssetsRelations = relations(
  trackableAssets,
  ({ one }) => ({
    trackable: one(trackableItems, {
      fields: [trackableAssets.trackableId],
      references: [trackableItems.id],
    }),
    uploadedByUser: one(users, {
      fields: [trackableAssets.uploadedByUserId],
      references: [users.id],
    }),
  })
)

export const trackableFormFieldsRelations = relations(
  trackableFormFields,
  ({ many, one }) => ({
    form: one(trackableForms, {
      fields: [trackableFormFields.formId],
      references: [trackableForms.id],
    }),
    answers: many(trackableFormAnswers),
  })
)

export const trackableFormSubmissionsRelations = relations(
  trackableFormSubmissions,
  ({ many, one }) => ({
    trackable: one(trackableItems, {
      fields: [trackableFormSubmissions.trackableId],
      references: [trackableItems.id],
    }),
    form: one(trackableForms, {
      fields: [trackableFormSubmissions.formId],
      references: [trackableForms.id],
    }),
    shareLink: one(trackableShareLinks, {
      fields: [trackableFormSubmissions.shareLinkId],
      references: [trackableShareLinks.id],
    }),
    submittedByUser: one(users, {
      fields: [trackableFormSubmissions.submittedByUserId],
      references: [users.id],
    }),
    answers: many(trackableFormAnswers),
  })
)

export const trackableFormAnswersRelations = relations(
  trackableFormAnswers,
  ({ one }) => ({
    submission: one(trackableFormSubmissions, {
      fields: [trackableFormAnswers.submissionId],
      references: [trackableFormSubmissions.id],
    }),
    field: one(trackableFormFields, {
      fields: [trackableFormAnswers.fieldId],
      references: [trackableFormFields.id],
    }),
  })
)
