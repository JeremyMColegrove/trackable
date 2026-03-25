import "server-only"

import { randomUUID } from "node:crypto"
import { hostname } from "node:os"

import { and, eq, inArray, lte } from "drizzle-orm"

import { db } from "@/db"
import { batchJobLeases, batchJobs, batchJobRuns } from "@/db/schema"
import type {
  BatchJobDefinition,
  BatchJobRecord,
  BatchJobRunError,
  BatchJobRunMetadata,
  BatchJobTrigger,
} from "@/server/batch/types"

const LEASE_BUFFER_MS = 60_000

function buildLeaseOwner() {
  return `${hostname()}:${process.pid}:${randomUUID()}`
}

export async function syncBatchJobDefinitions(
  definitions: BatchJobDefinition[]
) {
  if (definitions.length === 0) {
    return []
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    for (const definition of definitions) {
      const [createdJob] = await tx
        .insert(batchJobs)
        .values({
          key: definition.key,
          name: definition.name,
          schedule: definition.schedule,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: batchJobs.key,
        })
        .returning({
          id: batchJobs.id,
        })

      if (createdJob) {
        continue
      }

      await tx
        .update(batchJobs)
        .set({
          name: definition.name,
          schedule: definition.schedule,
          updatedAt: now,
        })
        .where(eq(batchJobs.key, definition.key))
    }
  })

  return db.query.batchJobs.findMany({
    where: inArray(
      batchJobs.key,
      definitions.map((definition) => definition.key)
    ),
    orderBy: (table, { asc }) => [asc(table.name)],
  })
}

export async function getBatchJobByKey(key: string) {
  return db.query.batchJobs.findFirst({
    where: eq(batchJobs.key, key),
  })
}

export async function listBatchJobs(keys: string[]) {
  if (keys.length === 0) {
    return []
  }

  return db.query.batchJobs.findMany({
    where: inArray(batchJobs.key, keys),
    orderBy: (table, { asc }) => [asc(table.name)],
  })
}

export async function listBatchJobRuns(jobKey: string, limit = 20) {
  return db.query.batchJobRuns.findMany({
    where: eq(batchJobRuns.jobKey, jobKey),
    orderBy: (table, { desc }) => [desc(table.startedAt)],
    limit,
  })
}

export async function setBatchJobEnabled(key: string, enabled: boolean) {
  const [updatedJob] = await db
    .update(batchJobs)
    .set({
      enabled,
      updatedAt: new Date(),
    })
    .where(eq(batchJobs.key, key))
    .returning()

  return updatedJob ?? null
}

export async function createBatchJobRun(input: {
  batchJobId: string
  jobKey: string
  trigger: BatchJobTrigger
  status: "running" | "skipped"
  startedAt: Date
  summary?: string
}) {
  const [run] = await db
    .insert(batchJobRuns)
    .values({
      batchJobId: input.batchJobId,
      jobKey: input.jobKey,
      trigger: input.trigger,
      status: input.status,
      startedAt: input.startedAt,
      summary: input.summary ?? null,
    })
    .returning()

  return run
}

export async function markBatchJobStarted(jobId: string, startedAt: Date) {
  await db
    .update(batchJobs)
    .set({
      lastStartedAt: startedAt,
      updatedAt: startedAt,
    })
    .where(eq(batchJobs.id, jobId))
}

export async function completeBatchJobRun(input: {
  job: BatchJobRecord
  runId: string
  status: "success" | "failed" | "skipped"
  summary: string
  completedAt: Date
  durationMs: number
  metadata?: BatchJobRunMetadata
  errorDetails?: BatchJobRunError
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(batchJobRuns)
      .set({
        status: input.status,
        summary: input.summary,
        completedAt: input.completedAt,
        durationMs: input.durationMs,
        metadata: input.metadata ?? null,
        errorDetails: input.errorDetails ?? null,
      })
      .where(eq(batchJobRuns.id, input.runId))

    await tx
      .update(batchJobs)
      .set({
        lastCompletedAt: input.completedAt,
        lastStatus: input.status,
        lastSummary: input.summary,
        updatedAt: input.completedAt,
      })
      .where(eq(batchJobs.id, input.job.id))
  })
}

export async function recordSkippedManualRun(input: {
  job: BatchJobRecord
  trigger: BatchJobTrigger
  summary: string
}) {
  const startedAt = new Date()
  const [run] = await db.transaction(async (tx) => {
    const [createdRun] = await tx
      .insert(batchJobRuns)
      .values({
        batchJobId: input.job.id,
        jobKey: input.job.key,
        trigger: input.trigger,
        status: "skipped",
        startedAt,
        completedAt: startedAt,
        durationMs: 0,
        summary: input.summary,
      })
      .returning()

    await tx
      .update(batchJobs)
      .set({
        lastCompletedAt: startedAt,
        lastStatus: "skipped",
        lastSummary: input.summary,
        updatedAt: startedAt,
      })
      .where(eq(batchJobs.id, input.job.id))

    return [createdRun]
  })

  return run
}

export async function tryAcquireBatchLease(input: {
  job: BatchJobRecord
  timeoutMs: number
}) {
  const now = new Date()
  const lockedBy = buildLeaseOwner()
  const lockedUntil = new Date(
    now.getTime() + input.timeoutMs + LEASE_BUFFER_MS
  )

  const [updatedLease] = await db
    .update(batchJobLeases)
    .set({
      batchJobId: input.job.id,
      jobKey: input.job.key,
      lockedUntil,
      lockedBy,
      updatedAt: now,
    })
    .where(
      and(
        eq(batchJobLeases.batchJobId, input.job.id),
        lte(batchJobLeases.lockedUntil, now)
      )
    )
    .returning({
      jobKey: batchJobLeases.jobKey,
    })

  if (!updatedLease) {
    const [createdLease] = await db
      .insert(batchJobLeases)
      .values({
        batchJobId: input.job.id,
        jobKey: input.job.key,
        lockedUntil,
        lockedBy,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: batchJobLeases.batchJobId,
      })
      .returning({
        jobKey: batchJobLeases.jobKey,
      })

    if (!createdLease) {
      return null
    }
  }

  return {
    lockedBy,
    lockedUntil,
  }
}

export async function attachRunToBatchLease(input: {
  jobKey: string
  lockedBy: string
  runId: string
}) {
  await db
    .update(batchJobLeases)
    .set({
      runId: input.runId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(batchJobLeases.jobKey, input.jobKey),
        eq(batchJobLeases.lockedBy, input.lockedBy)
      )
    )
}

export async function releaseBatchLease(jobKey: string, lockedBy: string) {
  await db
    .delete(batchJobLeases)
    .where(
      and(
        eq(batchJobLeases.jobKey, jobKey),
        eq(batchJobLeases.lockedBy, lockedBy)
      )
    )
}
