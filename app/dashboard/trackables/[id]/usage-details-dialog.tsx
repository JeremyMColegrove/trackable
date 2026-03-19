"use client";

import { DataTable } from "@/components/ui/data-table";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

import type { UsageEventRow } from "./table-types";
import { usageHitColumns } from "./usage-hit-columns";

export function UsageDetailsDialog({
	usageEvent,
	open,
	onOpenChange,
}: {
	usageEvent: UsageEventRow;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>API Usage Details</DialogTitle>
				</DialogHeader>

				<div className="min-h-0 overflow-hidden">
					<DataTable
						columns={usageHitColumns}
						data={usageEvent.hits}
						emptyMessage="No API usage hits have been recorded yet."
						initialPageSize={5}
						fillHeight
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
