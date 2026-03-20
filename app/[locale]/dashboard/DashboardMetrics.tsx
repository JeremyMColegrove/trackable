"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { T } from "gt-next";

type ActivityPoint = {
	dayOffset: number;
	count: number;
};

const activityChartConfig = {
	submissions: {
		label: "Submissions",
		color: "var(--chart-2)",
	},
	usage: {
		label: "Logs",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
});

function buildChartData(
	submissionActivity: ActivityPoint[],
	usageActivity: ActivityPoint[],
) {
	const today = new Date();

	return submissionActivity.map((point, index) => {
		const date = new Date(today);
		date.setDate(
			today.getDate() - (submissionActivity.length - point.dayOffset - 1),
		);

		return {
			label: weekdayFormatter.format(date),
			fullLabel: tooltipDateFormatter.format(date),
			submissions: point.count,
			usage: usageActivity[index]?.count ?? 0,
		};
	});
}

export function DashboardMetrics() {
	const trpc = useTRPC();
	const { data: metrics, isLoading } = useQuery(
		trpc.dashboard.getMetrics.queryOptions(),
	);

	const chartData = buildChartData(
		metrics?.submissionActivity ?? [],
		metrics?.usageActivity ?? [],
	);

	return (
		<Card className="rounded-xl border-border bg-card shadow-none">
			<CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
				<div className="flex flex-col gap-1">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						
                        						<T>Activity</T>
                        					</CardTitle>
					<CardDescription>
						
                        						<T>Hover a day to compare submissions and usage tracking</T>
                        					</CardDescription>
				</div>
				<BarChart3 className="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent className="pt-0">
				{isLoading ? (
					<Skeleton className="h-36 w-full rounded-lg" />
				) : (
					<ChartContainer
						config={activityChartConfig}
						className="h-[132px] min-h-[132px] w-full aspect-auto [&_.recharts-responsive-container]:!h-full"
					>
						<BarChart
							accessibilityLayer
							data={chartData}
							margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
							barGap={1}
							barCategoryGap="28%"
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
							<Bar
								dataKey="submissions"
								fill="var(--color-submissions)"
								radius={[4, 4, 0, 0]}
								maxBarSize={14}
							/>
							<Bar
								dataKey="usage"
								fill="var(--color-usage)"
								radius={[4, 4, 0, 0]}
								maxBarSize={14}
							/>
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
