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
  trackableAccessSubjectTypeEnum,
  trackableFormFieldKindEnum,
  trackableFormStatusEnum,
  trackableKindEnum,
  trackableSubmissionSourceEnum,
} from "@/db/schema/enums"
import { workspaces } from "@/db/schema/team"
import type {
  FormAnswerValue,
  FormFieldConfig,
  SubmissionMetadata,
  TrackableKind,
  TrackableSubmissionSnapshot,
  TrackableSettings,
} from "@/db/schema/types"
import { users } from "@/db/schema/users"

export const trackableItems = pgTable(
  "trackable_items",
  {
    id: uuidPrimaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    kind: trackableKindEnum("kind").$type<TrackableKind>().notNull(),
    activeFormId: uuid("active_form_id").references(
      (): AnyPgColumn => trackableForms.id,
      {
        onDelete: "set null",
      }
    ),
    settings: settingsJson<TrackableSettings>(),
    submissionCount: submissionCount(),
    apiUsageCount: usageCount("api_usage_count"),
    lastSubmissionAt: nullableTimestamp("last_submission_at"),
    lastApiUsageAt: nullableTimestamp("last_api_usage_at"),
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
    trackableId: uuid("trackable_id")
      .notNull()
      .references((): AnyPgColumn => trackableItems.id, {
        onDelete: "cascade",
      }),
    subjectType: trackableAccessSubjectTypeEnum("subject_type").notNull(),
    subjectUserId: text("subject_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    subjectEmail: text("subject_email"),
    role: trackableAccessRoleEnum("role").default("submit").notNull(),
    createdByUserId: createdByUserId().references(() => users.id, {
      onDelete: "cascade",
    }),
    acceptedAt: nullableTimestamp("accepted_at"),
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
    trackableId: uuid("trackable_id")
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    role: trackableAccessRoleEnum("role").default("submit").notNull(),
    expiresAt: expiresAt(),
    revokedAt: revokedAt(),
    createdByUserId: createdByUserId().references(() => users.id, {
      onDelete: "cascade",
    }),
    lastUsedAt: nullableTimestamp("last_used_at"),
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
    trackableId: uuid("trackable_id")
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: trackableFormStatusEnum("status").default("draft").notNull(),
    submitLabel: text("submit_label"),
    successMessage: text("success_message"),
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

export const trackableFormFields = pgTable(
  "trackable_form_fields",
  {
    id: uuidPrimaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references(() => trackableForms.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    kind: trackableFormFieldKindEnum("kind").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    required: boolean("required").default(false).notNull(),
    position: sortOrder(),
    config: jsonb("config").$type<FormFieldConfig>().notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
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
    trackableId: uuid("trackable_id")
      .notNull()
      .references(() => trackableItems.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => trackableForms.id, { onDelete: "cascade" }),
    shareLinkId: uuid("share_link_id").references(
      () => trackableShareLinks.id,
      { onDelete: "set null" }
    ),
    submittedByUserId: text("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedEmail: text("submitted_email"),
    source: trackableSubmissionSourceEnum("source").notNull(),
    submissionSnapshot: jsonb("submission_snapshot")
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

export const trackableFormAnswers = pgTable(
  "trackable_form_answers",
  {
    id: uuidPrimaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => trackableFormSubmissions.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => trackableFormFields.id, { onDelete: "cascade" }),
    value: jsonb("value").$type<FormAnswerValue>().notNull(),
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
    }),
    accessGrants: many(trackableAccessGrants),
    shareLinks: many(trackableShareLinks),
    forms: many(trackableForms),
    submissions: many(trackableFormSubmissions),
  })
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
