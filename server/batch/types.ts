import type { Logger } from "pino"
import { z } from "zod"

import type { db } from "@/db"

export const batchJobRunStatusSchema = z.enum([
  "running",
  "success",
  "failed",
  "skipped",
])

export const batchJobTriggerSchema = z.enum(["cron", "manual"])

export const batchJobMetadataSchema = z.record(z.string(), z.unknown())

export const batchJobRunErrorSchema = z.object({
  name: z.string(),
  message: z.string(),
  stack: z.string().optional(),
})

export const batchJobResultSchema = z.object({
  status: batchJobRunStatusSchema.exclude(["running"]),
  summary: z.string().trim().min(1).max(500),
  metadata: batchJobMetadataSchema.optional(),
})

export type BatchJobRunStatus = z.infer<typeof batchJobRunStatusSchema>
export type BatchJobTrigger = z.infer<typeof batchJobTriggerSchema>
export type BatchJobRunMetadata = z.infer<typeof batchJobMetadataSchema>
export type BatchJobRunError = z.infer<typeof batchJobRunErrorSchema>
export type BatchJobResult = z.infer<typeof batchJobResultSchema>

export interface BatchJobDefinition {
  key: string
  name: string
  schedule: string
  concurrency: number
  timeoutMs: number
}

export interface BatchJobContext {
  db: typeof db
  now: Date
  runId: string
  signal: AbortSignal
  logger: Logger
}

export interface BatchJobRecord {
  id: string
  key: string
  name: string
  schedule: string
  enabled: boolean
  lastStartedAt: Date | null
  lastCompletedAt: Date | null
  lastStatus: BatchJobRunStatus | null
  lastSummary: string | null
  updatedAt: Date
}

export interface BatchJobRunRecord {
  id: string
  batchJobId: string
  jobKey: string
  trigger: BatchJobTrigger
  status: BatchJobRunStatus
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
  summary: string | null
  errorDetails: BatchJobRunError | null
  metadata: BatchJobRunMetadata | null
}
