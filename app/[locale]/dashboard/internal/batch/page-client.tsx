"use client"

import { useMemo, useState, useTransition } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Activity, Play, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

import { RequireAuth } from "@/components/auth/require-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTRPC } from "@/trpc/client"
import { T } from "gt-next";

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
  if (!value) {
    return "Never"
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
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

function BatchJobsPageSkeleton() {
  return (
    <main className="flex-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </main>
  )
}

export function BatchJobsPageClient() {
  return (
    <RequireAuth fallback={<BatchJobsPageSkeleton />}>
      <BatchJobsPageContent />
    </RequireAuth>
  )
}

function BatchJobsPageContent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const jobsQuery = useQuery(trpc.batch.listJobs.queryOptions())
  const jobs = jobsQuery.data ?? EMPTY_JOBS
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const effectiveSelectedJobKey = selectedJobKey ?? jobs[0]?.key ?? null
  const selectedJob =
    jobs.find((job) => job.key === effectiveSelectedJobKey) ?? jobs[0] ?? null

  const runsQuery = useQuery(
    trpc.batch.listRuns.queryOptions(
      {
        key: selectedJob?.key ?? "",
        limit: 20,
      },
      {
        enabled: Boolean(selectedJob?.key),
      }
    )
  )

  const invalidateBatchQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.batch.listJobs.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.batch.listRuns.queryKey({
          key: selectedJob?.key ?? "",
          limit: 20,
        }),
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
        toast.success(result.enabled ? "Job enabled." : "Job disabled.")
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
    <main className="flex-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl"><T>Batch Jobs</T></CardTitle>
              <CardDescription>
                
                                              <T>Internal cron-driven batch processes with DB-backed run history
                                              and overlap protection.</T>
                                            </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={jobSummary.schedulerEnabled ? "default" : "outline"}
              >
                {jobSummary.schedulerEnabled
                  ? "Scheduler enabled"
                  : "Scheduler disabled"}
              </Badge>
              <Button
                variant="outline"
                onClick={() => {
                  startTransition(() => {
                    void invalidateBatchQueries()
                  })
                }}
                disabled={jobsQuery.isLoading || isPending}
              >
                <RefreshCcw className="size-4" />
                
                                              <T>Refresh</T>
                                            </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-sm text-muted-foreground"><T>Registered jobs</T></p>
              <p className="mt-2 text-2xl font-semibold">{jobSummary.total}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-sm text-muted-foreground"><T>Enabled jobs</T></p>
              <p className="mt-2 text-2xl font-semibold">
                {jobSummary.enabled}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-sm text-muted-foreground">
                
                                              <T>Jobs with last failure</T>
                                            </p>
              <p className="mt-2 text-2xl font-semibold">{jobSummary.failed}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="text-base"><T>Registered jobs</T></CardTitle>
              <CardDescription>
                
                                              <T>Select a job to inspect history or trigger a run manually.</T>
                                            </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6"><T>Job</T></TableHead>
                    <TableHead><T>Schedule</T></TableHead>
                    <TableHead><T>Status</T></TableHead>
                    <TableHead className="pr-6 text-right"><T>Enabled</T></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow
                      key={job.key}
                      className="cursor-pointer"
                      data-state={
                        job.key === selectedJob?.key ? "selected" : undefined
                      }
                      onClick={() => setSelectedJobKey(job.key)}
                    >
                      <TableCell className="pl-6">
                        <div className="flex flex-col">
                          <span className="font-medium">{job.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {job.key}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {job.schedule}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(job.lastStatus)}>
                          {job.lastStatus ?? "never"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end">
                          <Switch
                            checked={job.enabled}
                            onCheckedChange={(enabled) =>
                              setEnabledMutation.mutate({
                                key: job.key,
                                enabled,
                              })
                            }
                            onClick={(event) => event.stopPropagation()}
                            disabled={setEnabledMutation.isPending}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        
                                                                      <T>No batch jobs are registered.</T>
                                                                    </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base">
                  {selectedJob?.name ?? "Run history"}
                </CardTitle>
                <CardDescription>
                  {selectedJob
                    ? `Manual trigger and recent runs for ${selectedJob.key}.`
                    : "Select a job to inspect its runs."}
                </CardDescription>
              </div>
              <Button
                onClick={() =>
                  selectedJob
                    ? triggerMutation.mutate({ key: selectedJob.key })
                    : undefined
                }
                disabled={!selectedJob || triggerMutation.isPending}
              >
                <Play className="size-4" />
                
                                              <T>Run now</T>
                                            </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedJob ? (
                <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        
                                                                      <T>Last summary</T>
                                                                    </p>
                      <p className="mt-1 text-sm font-medium">
                        {selectedJob.lastSummary ?? "No runs recorded yet."}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(selectedJob.lastStatus)}>
                      {selectedJob.lastStatus ?? "never"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground"><T>Last started</T></p>
                      <p className="mt-1 font-medium">
                        {formatDateTime(selectedJob.lastStartedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground"><T>Last completed</T></p>
                      <p className="mt-1 font-medium">
                        {formatDateTime(selectedJob.lastCompletedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground"><T>Timeout</T></p>
                      <p className="mt-1 font-medium">
                        {(selectedJob.timeoutMs / 1000).toLocaleString()}<T>s</T>
                                                                    </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground"><T>Concurrency</T></p>
                      <p className="mt-1 font-medium">
                        {selectedJob.concurrency}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                  
                                                        <T>No job selected.</T>
                                                      </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium"><T>Recent runs</T></p>
                </div>
                <div className="space-y-3">
                  {(runsQuery.data ?? []).map((run) => (
                    <div
                      key={run.id}
                      className="rounded-2xl border border-border/70 bg-background/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {run.summary ?? "No summary provided."}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            
                                                                  <T>Started</T> {formatDateTime(run.startedAt)}
                          </p>
                        </div>
                        <Badge variant={getStatusVariant(run.status)}>
                          {run.status}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <span><T>Trigger:</T> {run.trigger}</span>
                        <span>
                          
                                                            <T>Duration:</T>{" "}
                          {run.durationMs === null
                            ? "In progress"
                            : `${run.durationMs.toLocaleString()}ms`}
                        </span>
                        <span>
                          
                                                            <T>Completed:</T> {formatDateTime(run.completedAt)}
                        </span>
                      </div>
                      {run.errorDetails?.message ? (
                        <p className="mt-3 text-xs text-destructive">
                          {run.errorDetails.message}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {!runsQuery.isLoading &&
                  (runsQuery.data?.length ?? 0) === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                      
                                                                    <T>No runs have been recorded for this job yet.</T>
                                                                  </div>
                  ) : null}
                  {runsQuery.isLoading ? (
                    <Skeleton className="h-28 rounded-2xl" />
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
