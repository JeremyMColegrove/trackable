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
import { T } from "gt-next"
import { ChartLine } from "lucide-react"
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

const activityChartConfig = {
  submissions: {
    label: "Submissions",
    color: getTrackableKindVisuals("survey").chartColor,
  },
  usage: {
    label: "Logs",
    color: getTrackableKindVisuals("api_ingestion").chartColor,
  },
} satisfies ChartConfig

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
  const trpc = useTRPC()
  const { data: metrics, isLoading } = useQuery(
    trpc.dashboard.getMetrics.queryOptions()
  )

  const chartData = buildChartData(
    metrics?.activityWindowStart,
    metrics?.submissionActivity ?? [],
    metrics?.usageActivity ?? []
  )

  return (
    <div className="xl:grid xl:grid-cols-[192px_1fr] xl:gap-4">
      <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3 xl:mb-0 xl:grid-cols-1 xl:gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium sm:text-sm">
              <T>Total</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <div className="text-lg font-bold sm:text-xl">
                {metrics?.trackablesCount?.toLocaleString() ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="truncate text-xs font-medium sm:text-sm">
              <span>
                <T>Surveys</T>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <div className="text-lg font-bold sm:text-xl">
                {metrics?.activeSurveysCount?.toLocaleString() ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="flex flex-row gap-2 text-xs font-medium sm:text-sm">
              <span>
                <T>Logs </T>
              </span>
              <div className="text-primary/50">
                <T>(7 days)</T>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <div className="text-lg font-bold sm:text-xl">
                {metrics?.recentLogsCount?.toLocaleString() ?? 0}
              </div>
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
              <T>Compare submissions and usage tracking over the last 7 days</T>
            </CardDescription>
          </div>
          <ChartLine className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : (
            <ChartContainer
              config={activityChartConfig}
              className="aspect-auto h-[100px] min-h-[100px] w-full xl:h-[140px] xl:min-h-[140px] [&_.recharts-responsive-container]:h-full!"
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
