"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { getTrackableKindVisuals } from "@/lib/trackable-kind"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { T, useGT } from "gt-next"
import { ChartLine, ClipboardList, Database, LayoutGrid } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

type ActivityPoint = {
  dayOffset: number
  count: number
}

type MetricsResponse = {
  activeTrackablesCount: number
  trackablesCount: number
  activeSurveysCount: number
  recentLogsCount: number
  totalSubmissions: number
  totalUsageTracks: number
  activityWindowStart: string
  submissionActivity: ActivityPoint[]
  usageActivity: ActivityPoint[]
}

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
})
const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

function buildChartData(
  windowStartIso: string | undefined,
  submissionActivity: ActivityPoint[],
  usageActivity: ActivityPoint[]
) {
  if (!windowStartIso) {
    return []
  }

  const windowStart = new Date(windowStartIso)

  return submissionActivity.map((point, index) => {
    const date = new Date(windowStart)
    date.setUTCDate(windowStart.getUTCDate() + point.dayOffset)

    return {
      label: weekdayFormatter.format(date),
      fullLabel: tooltipDateFormatter.format(date),
      submissions: point.count,
      usage: usageActivity[index]?.count ?? 0,
    }
  })
}

export function DashboardMetrics() {
  const gt = useGT()
  const trpc = useTRPC()
  const { data: metrics, isLoading } = useQuery(
    trpc.dashboard.getMetrics.queryOptions()
  )
  const activityChartConfig = {
    submissions: {
      label: gt("Submissions"),
      color: getTrackableKindVisuals("survey").chartColor,
    },
    usage: {
      label: gt("Logs"),
      color: getTrackableKindVisuals("api_ingestion").chartColor,
    },
  } satisfies ChartConfig

  const chartData = buildChartData(
    metrics?.activityWindowStart,
    metrics?.submissionActivity ?? [],
    metrics?.usageActivity ?? []
  )

  return (
    <div className="xl:grid xl:grid-cols-[220px_1fr] xl:gap-4">
      <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3 xl:mb-0 xl:grid-cols-1 xl:gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <T>Total</T>
            </CardTitle>
            <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-14" />
                <Skeleton className="mt-1.5 h-3 w-20" />
              </>
            ) : (
              <>
                <div className="text-xl font-bold tabular-nums sm:text-2xl">
                  {metrics?.trackablesCount?.toLocaleString() ?? 0}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metrics?.activeTrackablesCount?.toLocaleString() ?? 0}{" "}
                  <T>active</T>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="truncate text-sm font-medium text-muted-foreground">
              <T>Surveys</T>
            </CardTitle>
            <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-14" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-xl font-bold tabular-nums sm:text-2xl">
                  {metrics?.activeSurveysCount?.toLocaleString() ?? 0}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metrics?.totalSubmissions?.toLocaleString() ?? 0}{" "}
                  <T>submissions</T>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <T>Logs</T>
            </CardTitle>
            <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-14" />
                <Skeleton className="mt-1.5 h-3 w-20" />
              </>
            ) : (
              <>
                <div className="text-xl font-bold tabular-nums sm:text-2xl">
                  {metrics?.recentLogsCount?.toLocaleString() ?? 0}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metrics?.totalUsageTracks?.toLocaleString() ?? 0}{" "}
                  <T>all-time</T>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border bg-card shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <T>Activity Trends</T>
            </CardTitle>
            <CardDescription className="text-xs">
              <T>
                Compare submissions and usage tracking over the last 7 days
              </T>
            </CardDescription>
          </div>
          <ChartLine className="size-4 shrink-0 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : (
            <>
              <ChartContainer
                config={activityChartConfig}
                className="aspect-auto h-[100px] min-h-[100px] w-full xl:h-[120px] xl:min-h-[120px] [&_.recharts-responsive-container]:h-full!"
              >
                <LineChart
                  accessibilityLayer
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullLabel ?? ""
                        }
                      />
                    }
                  />
                  <Line
                    dataKey="submissions"
                    type="monotone"
                    stroke="var(--color-submissions)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    dataKey="usage"
                    type="monotone"
                    stroke="var(--color-usage)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
              <div className="mt-2 flex justify-end gap-4">
                {Object.entries(activityChartConfig).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: config.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {config.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
