"use client";

import { useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { UsageEventUrlState } from "@/lib/usage-event-search";

import type { UsageEventTableData } from "./table-types";
import { UsageDetailsDialog } from "./usage-details-dialog";
import { getUsageEventColumns } from "./usage-event-columns";

export function UsageEventsTableSkeleton({
	title = "Logs",
	description = "Preparing the derived event table for the current URL state.",
}: {
	title?: React.ReactNode;
	description?: string;
}) {
	return (
		<div className="min-w-0 space-y-4">
			<div className="flex flex-col gap-4 px-1 py-4">
				<div className="flex justify-between items-end gap-3 lg:flex-row lg:items-end lg:justify-between">
					<div className="flex flex-col justify-start gap-2">
						<h3 className="text-lg font-semibold">{title}</h3>
						<p className="text-sm text-muted-foreground">{description}</p>
					</div>
				</div>
			</div>

			<div className="min-w-0 max-w-full overflow-hidden rounded-md border">
				<div className="border-b bg-muted/20 px-4 py-3">
					<div className="grid grid-cols-[1.6fr_1fr_1fr_1.2fr] gap-4">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-28" />
					</div>
				</div>
				<div className="divide-y">
					{Array.from({ length: 6 }).map((_, index) => (
						<div
							key={index}
							className="grid grid-cols-[1.6fr_1fr_1fr_1.2fr] gap-4 px-4 py-4"
						>
							<div className="space-y-2">
								<Skeleton className="h-4 w-4/5" />
								<Skeleton className="h-3 w-2/5" />
							</div>
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-4 w-5/6" />
						</div>
					))}
				</div>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Skeleton className="h-4 w-36" />
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-20 rounded-md" />
					<Skeleton className="h-8 w-20 rounded-md" />
				</div>
			</div>
		</div>
	);
}

export function UsageEventsTable({
	data,
	onFilterToGroup,
	title = "Logs",
	description = "Derived log event rows from the current query and view settings.",
}: {
	data: UsageEventTableData;
	onFilterToGroup: (patch: Partial<UsageEventUrlState>) => void;
	title?: React.ReactNode;
	description?: string;
}) {
	const [selectedUsageEvent, setSelectedUsageEvent] = useState<
		UsageEventTableData["rows"][number] | null
	>(null);

	return (
		<>
			<DataTable
				columns={getUsageEventColumns(data.columns)}
				data={data.rows}
				title={title}
				description={`${description} ${data.totalMatchedEvents} matching event${data.totalMatchedEvents === 1 ? "" : "s"} across ${data.totalGroupedRows} row${data.totalGroupedRows === 1 ? "" : "s"}.`}
				onRowClick={setSelectedUsageEvent}
				emptyMessage="No logs have been recorded yet."
				initialPageSize={10}
			/>
			{selectedUsageEvent ? (
				<UsageDetailsDialog
					usageEvent={selectedUsageEvent}
					onFilterToGroup={onFilterToGroup}
					open
					onOpenChange={(open) => {
						if (!open) {
							setSelectedUsageEvent(null);
						}
					}}
				/>
			) : null}
		</>
	);
}
