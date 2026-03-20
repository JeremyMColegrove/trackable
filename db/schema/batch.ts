import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import {
  createdAt,
  nullableTimestamp,
  updatedAt,
  uuidPrimaryKey,
} from "@/db/schema/_shared"
import { batchJobRunStatusEnum, batchJobTriggerEnum } from "@/db/schema/enums"
import type {
  BatchJobRunError,
  BatchJobRunMetadata,
} from "@/server/batch/types"

export const batchJobs = pgTable(
  "batch_jobs",
  {
    id: uuidPrimaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    schedule: text("schedule").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    lastStartedAt: nullableTimestamp("last_started_at"),
    lastCompletedAt: nullableTimestamp("last_completed_at"),
    lastStatus: batchJobRunStatusEnum("last_status"),
    lastSummary: text("last_summary"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("batch_jobs_key_idx").on(table.key)]
)

export const batchJobRuns = pgTable(
  "batch_job_runs",
  {
    id: uuidPrimaryKey(),
    batchJobId: uuid("batch_job_id")
      .notNull()
      .references(() => batchJobs.id, { onDelete: "cascade" }),
    jobKey: text("job_key").notNull(),
    trigger: batchJobTriggerEnum("trigger").notNull(),
    status: batchJobRunStatusEnum("status").notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: nullableTimestamp("completed_at"),
    durationMs: integer("duration_ms"),
    summary: text("summary"),
    errorDetails: jsonb("error_details").$type<BatchJobRunError>(),
    metadata: jsonb("metadata").$type<BatchJobRunMetadata>(),
    createdAt: createdAt(),
  },
  (table) => [
    index("batch_job_runs_job_key_idx").on(table.jobKey),
    index("batch_job_runs_batch_job_idx").on(table.batchJobId),
    index("batch_job_runs_started_at_idx").on(table.startedAt),
  ]
)

export const batchJobLeases = pgTable(
  "batch_job_leases",
  {
    batchJobId: uuid("batch_job_id")
      .primaryKey()
      .references(() => batchJobs.id, { onDelete: "cascade" }),
    jobKey: text("job_key").notNull(),
    lockedUntil: timestamp("locked_until", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    lockedBy: text("locked_by").notNull(),
    runId: uuid("run_id"),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("batch_job_leases_job_key_idx").on(table.jobKey),
    index("batch_job_leases_locked_until_idx").on(table.lockedUntil),
  ]
)

export const batchJobsRelations = relations(batchJobs, ({ many, one }) => ({
  runs: many(batchJobRuns),
  lease: one(batchJobLeases, {
    fields: [batchJobs.id],
    references: [batchJobLeases.batchJobId],
  }),
}))

export const batchJobRunsRelations = relations(batchJobRuns, ({ one }) => ({
  job: one(batchJobs, {
    fields: [batchJobRuns.batchJobId],
    references: [batchJobs.id],
  }),
}))

export const batchJobLeasesRelations = relations(batchJobLeases, ({ one }) => ({
  job: one(batchJobs, {
    fields: [batchJobLeases.batchJobId],
    references: [batchJobs.id],
  }),
}))
