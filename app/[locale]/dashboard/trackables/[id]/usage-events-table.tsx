"use client";

import { useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { UsageEventUrlState } from "@/lib/usage-event-search";

import type { UsageEventTableData } from "./table-types";
import { UsageDetailsDialog } from "./usage-details-dialog";
import { getUsageEventColumns } from "./usage-event-columns";

export function UsageEventsTableSkeleton() {
	return (
		<div className="min-w-0 space-y-4">
			<div className="min-w-0 max-w-full overflow-hidden rounded-md border shadow-xs">
				<div className="border-b bg-muted/20 px-4 py-3">
					<div className="grid grid-cols-[1.2fr_1.2fr_.8fr_1.8fr] gap-4">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-32" />
					</div>
				</div>
				<div className="divide-y">
					{Array.from({ length: 6 }).map((_, index) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
							key={index}
							className="grid grid-cols-[1.2fr_1.2fr_.8fr_1.8fr] gap-4 px-4 py-4"
						>
							<Skeleton className="h-4 w-5/6" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-4 w-full" />
						</div>
					))}
				</div>
			</div>

			<div className="flex items-center justify-between gap-3 pt-2">
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
	onApplyFilters,
	title = "",
	description = "",
}: {
	data: UsageEventTableData;
	onFilterToGroup: (patch: Partial<UsageEventUrlState>) => void;
	onApplyFilters: (patch: Partial<UsageEventUrlState>) => void;
	title?: React.ReactNode;
	description?: string;
}) {
	const [selectedUsageEvent, setSelectedUsageEvent] = useState<
		UsageEventTableData["rows"][number] | null
	>(null);

	const subtitle =
		description ||
		`${data.totalMatchedEvents} matching event${data.totalMatchedEvents === 1 ? "" : "s"} across ${data.totalGroupedRows} row${data.totalGroupedRows === 1 ? "" : "s"}.`;

	return (
		<>
			<DataTable
				columns={getUsageEventColumns(data.columns)}
				data={data.rows}
				title={title}
				description={subtitle}
				onRowClick={setSelectedUsageEvent}
				emptyMessage="No logs have been recorded yet."
				initialPageSize={10}
			/>
			{selectedUsageEvent ? (
				<UsageDetailsDialog
					usageEvent={selectedUsageEvent}
					onFilterToGroup={onFilterToGroup}
					onApplyFilters={onApplyFilters}
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
