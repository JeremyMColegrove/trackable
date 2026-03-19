"use client";

import { CreateTrackableDialog } from "@/app/dashboard/CreateProjectDialog";
import { DashboardMetrics } from "@/app/dashboard/DashboardMetrics";
import { DashboardTrackablesTable } from "@/app/dashboard/DashboardProjectsTable";
import { RequireAuth } from "@/components/auth/require-auth";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardPageSkeleton() {
	return (
		<main className="flex-1">
			<div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 sm:px-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="space-y-2">
						<Skeleton className="h-9 w-40" />
						<Skeleton className="h-5 w-72" />
					</div>
					<Skeleton className="h-10 w-36 rounded-md" />
				</div>

				<Skeleton className="h-56 rounded-xl" />

				<Separator className="my-2" />

				<div className="space-y-4">
					<Skeleton className="h-7 w-24" />
					<Skeleton className="h-72 rounded-xl" />
				</div>
			</div>
		</main>
	);
}

export function DashboardPageClient() {
	return (
		<RequireAuth fallback={<DashboardPageSkeleton />}>
			<main className="flex-1">
				<div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 sm:px-8">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div className="space-y-1">
							<h1 className="text-3xl font-semibold tracking-tight">
								Overview
							</h1>
							<p className="text-sm text-muted-foreground">
								Your high-level metrics and trackable activity.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<CreateTrackableDialog />
						</div>
					</div>

					<DashboardMetrics />

					<Separator className="my-2" />

					{/* <div className="space-y-4"> */}
					{/* <h2 className="text-lg font-semibold tracking-tight">Trackables</h2> */}
					<DashboardTrackablesTable />
					{/* </div> */}
				</div>
			</main>
		</RequireAuth>
	);
}
