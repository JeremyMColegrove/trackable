"use client";

import { CreateTrackableDialog } from "@/app/[locale]/dashboard/CreateProjectDialog";
import { DashboardMetrics } from "@/app/[locale]/dashboard/DashboardMetrics";
import { DashboardTrackablesTable } from "@/app/[locale]/dashboard/DashboardProjectsTable";
import { RequireAuth } from "@/components/auth/require-auth";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useGT } from "gt-next";
import { PageShell } from "@/components/page-shell";

function DashboardPageSkeleton() {
	return (
		<main className="flex-1">
			<div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8 sm:px-8">
				<div className="space-y-4">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<Skeleton className="h-9 w-40" />
						<Skeleton className="h-10 w-36 rounded-md" />
					</div>
					<Skeleton className="h-72 rounded-xl" />
				</div>

				<Separator className="my-2" />

				<Skeleton className="h-56 rounded-xl" />
			</div>
		</main>
	);
}

export function DashboardPageClient() {
	const gt = useGT();
	return (
		<RequireAuth fallback={<DashboardPageSkeleton />}>
			<PageShell
				title={gt("Overview")}
				headerActions={<CreateTrackableDialog />}
			>
				<DashboardMetrics />

				<DashboardTrackablesTable
					title={gt("Trackables")}
					titleVariant="default"
					description={gt("Manage your logs, surveys, and links")}
					showSearch={false}
					showViewOptions={false}
				/>
			</PageShell>
		</RequireAuth>
	);
}
