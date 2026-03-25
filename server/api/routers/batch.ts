import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { assertAdminControlsEnabled } from "@/server/admin-controls"
import { ensureDefaultBatchJobsRegistered } from "@/server/batch/jobs"
import { batchJobRegistry } from "@/server/batch/registry"
import {
  listBatchJobRuns,
  listBatchJobs,
  setBatchJobEnabled,
  syncBatchJobDefinitions,
} from "@/server/batch/repository"
import { batchJobRunner } from "@/server/batch/runner"

const batchJobKeyInput = z.object({
  key: z.string().trim().min(1),
})

export const batchRouter = createTRPCRouter({
  listJobs: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    await assertAdminControlsEnabled(ctx.auth.userId)

    const jobs = ensureDefaultBatchJobsRegistered()

    await syncBatchJobDefinitions(jobs.map((job) => job.getDefinition()))

    const records = await listBatchJobs(jobs.map((job) => job.key))
    const recordByKey = new Map(records.map((record) => [record.key, record]))

    return jobs.map((job) => {
      const record = recordByKey.get(job.key)

      return {
        key: job.key,
        name: job.name,
        schedule: job.schedule,
        timeoutMs: job.timeoutMs,
        concurrency: job.concurrency,
        enabled: record?.enabled ?? true,
        lastStartedAt: record?.lastStartedAt?.toISOString() ?? null,
        lastCompletedAt: record?.lastCompletedAt?.toISOString() ?? null,
        lastStatus: record?.lastStatus ?? null,
        lastSummary: record?.lastSummary ?? null,
        schedulerEnabled: process.env.BATCH_SCHEDULER_ENABLED !== "false",
      }
    })
  }),

  listRuns: protectedProcedure
    .input(
      z.object({
        key: z.string().trim().min(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.auth.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      await assertAdminControlsEnabled(ctx.auth.userId)

      ensureDefaultBatchJobsRegistered()
      const job = batchJobRegistry.getByKey(input.key)

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch job not found.",
        })
      }

      await syncBatchJobDefinitions([job.getDefinition()])

      const runs = await listBatchJobRuns(input.key, input.limit)

      return runs.map((run) => ({
        id: run.id,
        trigger: run.trigger,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        durationMs: run.durationMs,
        summary: run.summary,
        metadata: run.metadata ?? null,
        errorDetails: run.errorDetails ?? null,
      }))
    }),

  trigger: protectedProcedure
    .input(batchJobKeyInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      await assertAdminControlsEnabled(ctx.auth.userId)

      ensureDefaultBatchJobsRegistered()
      const job = batchJobRegistry.getByKey(input.key)

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch job not found.",
        })
      }

      return batchJobRunner.run(job, "manual")
    }),

  setEnabled: protectedProcedure
    .input(
      batchJobKeyInput.extend({
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      await assertAdminControlsEnabled(ctx.auth.userId)

      ensureDefaultBatchJobsRegistered()
      const job = batchJobRegistry.getByKey(input.key)

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch job not found.",
        })
      }

      await syncBatchJobDefinitions([job.getDefinition()])

      const updatedJob = await setBatchJobEnabled(input.key, input.enabled)

      if (!updatedJob) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch job not found.",
        })
      }

      return {
        key: updatedJob.key,
        enabled: updatedJob.enabled,
      }
    }),
})
