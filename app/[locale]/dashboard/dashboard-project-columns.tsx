"use client";

import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { TrackableKind } from "@/db/schema/types";
import { formatUserTimestamp } from "@/lib/date-time";
import {
	getTrackableKindShortLabel,
	getTrackableKindVisuals,
} from "@/lib/trackable-kind";
import type { ColumnDef } from "@tanstack/react-table";
import { T } from "gt-next";
import { ClipboardList, Database } from "lucide-react";

export type DashboardTrackableRow = {
	id: string;
	kind: TrackableKind;
	name: string;
	submissionCount: number;
	apiUsageCount: number;
	updatedAt: string | Date | null;
	workspace: {
		name: string;
	};
};

export const dashboardTrackableColumns: ColumnDef<DashboardTrackableRow>[] = [
	{
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={<T>Trackable</T>} />
		),
		cell: ({ row }) => (
			<div className="flex items-center gap-3">
				<div
					className={`flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background ${getTrackableKindVisuals(row.original.kind).borderClassName}`}
				>
					{row.original.kind === "survey" ? (
						<ClipboardList
							className={`size-4 ${getTrackableKindVisuals(row.original.kind).accentClassName}`}
						/>
					) : (
						<Database
							className={`size-4 ${getTrackableKindVisuals(row.original.kind).accentClassName}`}
						/>
					)}
				</div>
				<div className="font-medium">{row.original.name}</div>
			</div>
		),
		enableHiding: false,
	},
	{
		accessorKey: "kind",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={<T>Type</T>} />
		),
		cell: ({ row }) => (
			<Badge
				variant="outline"
				className={getTrackableKindVisuals(row.original.kind).badgeClassName}
			>
				{getTrackableKindShortLabel(row.original.kind)}
			</Badge>
		),
	},
	{
		accessorKey: "submissionCount",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={<T>Activity</T>} />
		),
		cell: ({ row }) => {
			const isSurvey = row.original.kind === "survey";
			return (
				<div className="font-medium tabular-nums">
					{(isSurvey
						? row.original.submissionCount
						: row.original.apiUsageCount
					).toLocaleString()}
					<span className="text-xs text-muted-foreground ml-1 font-normal">
						{isSurvey ? <T>submissions</T> : <T>logs</T>}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: "updatedAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={<T>Last Updated</T>} />
		),
		cell: ({ row }) => (
			<div className="text-sm text-muted-foreground">
				{row.original.updatedAt ? (
					formatUserTimestamp(row.original.updatedAt)
				) : (
					<T>Unknown</T>
				)}
			</div>
		),
	},
];
