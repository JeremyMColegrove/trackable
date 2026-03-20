"use client";

import { CreateTrackableDialog } from "@/app/[locale]/dashboard/CreateProjectDialog";
import { DashboardMetrics } from "@/app/[locale]/dashboard/DashboardMetrics";
import { DashboardTrackablesTable } from "@/app/[locale]/dashboard/DashboardProjectsTable";
import { RequireAuth } from "@/components/auth/require-auth";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useGT } from "gt-next";

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
			<main className="flex-1">
				<div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8 sm:px-8">
					<DashboardTrackablesTable
						title={gt("Overview")}
						titleVariant="page"
						headerButton={<CreateTrackableDialog />}
						description={undefined}
						showSearch={false}
						showViewOptions={false}
					/>

					<Separator className="my-2" />

					<div className="pt-4">
						<DashboardMetrics />
					</div>
				</div>
			</main>
		</RequireAuth>
	);
}
