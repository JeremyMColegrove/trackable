"use client"

import { useMemo, useState, useTransition } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Activity, Play, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/page-shell"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { formatUserTimestamp } from "@/lib/date-time"
import { useTRPC } from "@/trpc/client"
import { T, useGT } from "gt-next"

const EMPTY_JOBS: Array<{
  key: string
  name: string
  schedule: string
  timeoutMs: number
  concurrency: number
  enabled: boolean
  lastStartedAt: string | null
  lastCompletedAt: string | null
  lastStatus: string | null
  lastSummary: string | null
  schedulerEnabled: boolean
}> = []

function formatDateTime(value: string | null) {
  return formatUserTimestamp(value)
}

function getStatusVariant(status: string | null) {
  switch (status) {
    case "success":
      return "default" as const
    case "failed":
      return "destructive" as const
    case "skipped":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

export function BatchJobsPageSkeleton() {
  return (
    <main className="flex-1">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </main>
  )
}

export function BatchJobsPageClient() {
  return <BatchJobsPageContent />
}

function BatchJobsPageContent() {
  const gt = useGT()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const jobsQuery = useQuery(trpc.batch.listJobs.queryOptions())
  const jobs = jobsQuery.data ?? EMPTY_JOBS
  const [isPending, startTransition] = useTransition()

  const invalidateBatchQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.batch.listJobs.queryKey(),
      }),
    ])

  const triggerMutation = useMutation(
    trpc.batch.trigger.mutationOptions({
      onSuccess: async (result) => {
        toast.success(result.summary)
        await invalidateBatchQueries()
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  )

  const setEnabledMutation = useMutation(
    trpc.batch.setEnabled.mutationOptions({
      onSuccess: async (result) => {
        toast.success(result.enabled ? gt("Job enabled.") : gt("Job disabled."))
        await invalidateBatchQueries()
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  )

  const jobSummary = useMemo(() => {
    const enabledCount = jobs.filter((job) => job.enabled).length
    const failedCount = jobs.filter((job) => job.lastStatus === "failed").length

    return {
      total: jobs.length,
      enabled: enabledCount,
      failed: failedCount,
      schedulerEnabled: jobs[0]?.schedulerEnabled ?? false,
    }
  }, [jobs])

  return (
    <PageShell
      title={<T>Batch Jobs</T>}
      description={<T>Internal cron-driven batch processes.</T>}
      headerActions={
        <>
          <Badge
            variant={jobSummary.schedulerEnabled ? "default" : "secondary"}
            className="h-7"
          >
            {jobSummary.schedulerEnabled ? (
              <T>Scheduler enabled</T>
            ) : (
              <T>Scheduler disabled</T>
            )}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              startTransition(() => {
                void invalidateBatchQueries()
              })
            }}
            disabled={jobsQuery.isLoading || isPending}
            className="h-8"
          >
            <RefreshCcw className="mr-2 size-3.5" />
            <T>Refresh</T>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        {/* Jobs Data Table */}
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">
                  <T>Job Details</T>
                </TableHead>
                <TableHead>
                  <T>Schedule</T>
                </TableHead>
                <TableHead>
                  <T>Last Ran</T>
                </TableHead>
                <TableHead>
                  <T>Status</T>
                </TableHead>
                <TableHead className="pr-6 text-right">
                  <T>Actions</T>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.key}>
                  <TableCell className="pt-4 pl-6 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{job.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {job.key}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pt-4 align-top">
                    <span className="rounded bg-muted/50 px-2 py-0.5 font-mono text-sm text-muted-foreground">
                      {job.schedule}
                    </span>
                  </TableCell>
                  <TableCell className="pt-4 align-top">
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(job.lastStartedAt)}
                    </span>
                  </TableCell>
                  <TableCell className="pt-4 align-top">
                    <Badge
                      variant={getStatusVariant(job.lastStatus)}
                      className="capitalize"
                    >
                      {job.lastStatus ?? gt("unknown")}
                    </Badge>
                  </TableCell>
                  <TableCell className="pt-4 pr-6 align-top">
                    <div className="flex items-center justify-end gap-4">
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(enabled) =>
                          setEnabledMutation.mutate({ key: job.key, enabled })
                        }
                        disabled={setEnabledMutation.isPending}
                        className="scale-90 data-[state=checked]:bg-primary"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={gt("Run now")}
                        onClick={() => triggerMutation.mutate({ key: job.key })}
                        disabled={triggerMutation.isPending}
                      >
                        <Play className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    <T>No batch jobs are registered.</T>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageShell>
  )
}
