"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { VirtualDataTable } from "@/components/ui/virtual-data-table";
import {
	createUsageEventComputedColumnId,
	isUsageEventBuiltInColumnId,
	type UsageEventSortDirection,
	type UsageEventSortField,
	type UsageEventUrlState,
	type UsageEventVisibleColumnId,
} from "@/lib/usage-event-search";
import { T, useGT, useLocale } from "gt-next";
import { ChevronDown, KeyRoundIcon, LoaderCircle, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { UsageEventTableData } from "./table-types";
import { useTrackableDetails } from "./trackable-shell";
import { TrackableTableEmptyState } from "./trackable-table-empty-state";
import { UsageDetailsDialog } from "./usage-details-dialog";
import {
	getUsageEventColumns,
	resolveUsageEventVisibleColumns,
} from "./usage-event-columns";

export function UsageEventsTableSkeleton() {
	return (
		<div className="min-w-0 space-y-4">
			<div className="max-w-full min-w-0 overflow-hidden rounded-md border shadow-xs">
				<div className="border-b bg-muted/20 px-4 py-2">
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
							className="grid grid-cols-[1.2fr_1.2fr_.8fr_1.8fr] gap-4 px-4 py-2.5"
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
	computedFieldOptions,
	visibleColumnIds,
	onVisibleColumnIdsChange,
	onFilterToGroup,
	onOpenNearbyLogs,
	onGroupByField,
	onSortChange,
	exportFileName,
	currentSort,
	currentSortDirection,
	endMessage,
	isFetchingNextPage = false,
	onLoadMore,
	title = "",
	description = "",
	headerButton,
}: {
	data: UsageEventTableData;
	computedFieldOptions: Array<{ label: string; value: string }>;
	visibleColumnIds: UsageEventVisibleColumnId[];
	onVisibleColumnIdsChange: (columnIds: UsageEventVisibleColumnId[]) => void;
	onFilterToGroup: (patch: Partial<UsageEventUrlState>) => void;
	onOpenNearbyLogs: (eventId: string) => void | Promise<void>;
	onGroupByField: (field: string) => void;
	onSortChange: (
		sort: UsageEventSortField,
		dir: UsageEventSortDirection,
	) => void;
	exportFileName: string;
	currentSort: UsageEventSortField;
	currentSortDirection: UsageEventSortDirection;
	endMessage?: React.ReactNode;
	isFetchingNextPage?: boolean;
	onLoadMore: () => void;
	title?: React.ReactNode;
	description?: string;
	headerButton?: React.ReactNode;
}) {
	const [selectedUsageEvent, setSelectedUsageEvent] = useState<
		UsageEventTableData["rows"][number] | null
	>(null);
	const gt = useGT();
	const locale = useLocale();
	const trackable = useTrackableDetails();
	const dashboardBaseHref =
		locale === "en" ? "/dashboard" : `/${locale}/dashboard`;
	const connectionHref = `${dashboardBaseHref}/trackables/${trackable.id}/api-keys`;
	const canManageConnection = trackable.permissions.canManageApiKeys;
	const hasReceivedEvent = trackable.apiUsageCount > 0;
	const hasActiveConnection = trackable.apiKeys.some(
		(apiKey) => apiKey.status === "active",
	);
	const visibleColumns = useMemo(
		() => resolveUsageEventVisibleColumns(data.columns, visibleColumnIds),
		[data.columns, visibleColumnIds],
	);
	const currentVisibleColumnIds = useMemo(
		() => visibleColumns.map((column) => column.id),
		[visibleColumns],
	);
	const visibleBuiltInColumnIds = useMemo(
		() =>
			new Set(
				currentVisibleColumnIds.filter((columnId) =>
					isUsageEventBuiltInColumnId(columnId),
				),
			),
		[currentVisibleColumnIds],
	);
	const visibleComputedColumnIds = useMemo(
		() =>
			new Set<string>(
				currentVisibleColumnIds.filter(
					(columnId) => !isUsageEventBuiltInColumnId(columnId),
				),
			),
		[currentVisibleColumnIds],
	);
	const hiddenBuiltInColumns = useMemo(
		() =>
			data.columns.filter((column) => !visibleBuiltInColumnIds.has(column.id)),
		[data.columns, visibleBuiltInColumnIds],
	);
	const visibleColumnLabels = useMemo(
		() => new Set(visibleColumns.map((column) => column.label)),
		[visibleColumns],
	);
	const hiddenComputedFieldOptions = useMemo(
		() =>
			computedFieldOptions.filter(
				(option) =>
					!visibleColumnLabels.has(option.label) &&
					!visibleComputedColumnIds.has(
						createUsageEventComputedColumnId(option.value),
					),
			),
		[computedFieldOptions, visibleColumnLabels, visibleComputedColumnIds],
	);

	const subtitle =
		description ||
		`${data.totalMatchedEvents} ${
			data.totalMatchedEvents === 1
				? gt("matching event")
				: gt("matching events")
		} ${gt("across")} ${data.totalGroupedRows} ${
			data.totalGroupedRows === 1 ? gt("row.") : gt("rows.")
		}`;
	const isGroupedTable = data.columns.some(
		(column) => column.id === "totalHits",
	);
	const tableColumns = useMemo(
		() =>
			getUsageEventColumns(visibleColumns, {
				enableGroupByActions: !isGroupedTable,
				availableAggregateFields: data.availableAggregateFields,
				currentSort,
				currentSortDirection,
				translate: gt,
				onGroupByField,
				onSortChange,
				onRemoveColumn: (columnId) => {
					if (currentVisibleColumnIds.length <= 1) {
						return;
					}

					onVisibleColumnIdsChange(
						currentVisibleColumnIds.filter(
							(visibleColumnId) => visibleColumnId !== columnId,
						),
					);
				},
				canRemoveColumn: () => currentVisibleColumnIds.length > 1,
				headerTrailingContent: (
					<AddUsageEventColumnMenu
						hiddenBuiltInColumns={hiddenBuiltInColumns}
						hiddenComputedFieldOptions={hiddenComputedFieldOptions}
						onAddColumn={(columnId) => {
							if (currentVisibleColumnIds.includes(columnId)) {
								return;
							}

							onVisibleColumnIdsChange([...currentVisibleColumnIds, columnId]);
						}}
					/>
				),
			}),
		[
			currentVisibleColumnIds,
			currentSort,
			currentSortDirection,
			data.availableAggregateFields,
			gt,
			hiddenBuiltInColumns,
			hiddenComputedFieldOptions,
			isGroupedTable,
			onVisibleColumnIdsChange,
			onGroupByField,
			onSortChange,
			visibleColumns,
		],
	);
	const emptyState = hasReceivedEvent ? (
		gt("No logs found.")
	) : hasActiveConnection ? (
		<TrackableTableEmptyState
			title={gt("Waiting for the first log...")}
			description={gt(
				"Your connection is ready. New logs will show up here after the first one is received.",
			)}
			actionHref={canManageConnection ? connectionHref : undefined}
			actionLabel={canManageConnection ? gt("View connection") : undefined}
		/>
	) : (
		<TrackableTableEmptyState
			title={gt("No logs yet")}
			description={gt(
				"Set up a connection first so this trackable can start receiving log events.",
			)}
			actionIcon={<KeyRoundIcon />}
			actionHref={canManageConnection ? connectionHref : undefined}
			actionLabel={canManageConnection ? gt("Open Connection") : undefined}
		/>
	);
	const footerContent =
		data.rows.length > 0 ? (
			data.hasMore ? (
				<Button
					type="button"
					variant="ghost"
					onClick={onLoadMore}
					disabled={isFetchingNextPage}
					className="w-full"
				>
					{isFetchingNextPage ? (
						<LoaderCircle className="size-4 animate-spin" />
					) : (
						<ChevronDown />
					)}
					{isFetchingNextPage ? gt("Loading...") : gt("Load more")}
				</Button>
			) : (
				(endMessage ?? gt("All loaded"))
			)
		) : undefined;

	return (
		<>
			<VirtualDataTable
				headerButton={headerButton}
				exportOptions={{
					fileName: exportFileName,
				}}
				columns={tableColumns}
				data={data.rows}
				title={title}
				description={subtitle}
				footer={footerContent}
				onRowClick={setSelectedUsageEvent}
				emptyMessage={emptyState}
				scrollMode="window"
				estimateRowHeight={44}
				enableColumnResizing
				manualSorting
				classNames={{
					cell: "py-1",
				}}
			/>
			{selectedUsageEvent ? (
				<UsageDetailsDialog
					usageEvent={selectedUsageEvent}
					onFilterToGroup={onFilterToGroup}
					onOpenNearbyLogs={onOpenNearbyLogs}
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

function AddUsageEventColumnMenu({
	hiddenBuiltInColumns,
	hiddenComputedFieldOptions,
	onAddColumn,
}: {
	hiddenBuiltInColumns: UsageEventTableData["columns"];
	hiddenComputedFieldOptions: Array<{ label: string; value: string }>;
	onAddColumn: (columnId: UsageEventVisibleColumnId) => void;
}) {
	const gt = useGT();
	const hasHiddenColumns =
		hiddenBuiltInColumns.length > 0 || hiddenComputedFieldOptions.length > 0;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-7 rounded-md text-muted-foreground hover:text-foreground"
					aria-label={gt("Add column")}
					title={gt("Add column")}
					disabled={!hasHiddenColumns}
				>
					<Plus className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					<T>Add column</T>
				</DropdownMenuLabel>
				{!hasHiddenColumns ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem disabled>
							<T>No more columns available</T>
						</DropdownMenuItem>
					</>
				) : null}
				{hiddenBuiltInColumns.length > 0 ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>
							<T>Default columns</T>
						</DropdownMenuLabel>
						{hiddenBuiltInColumns.map((column) => (
							<DropdownMenuItem
								key={column.id}
								onClick={() => onAddColumn(column.id)}
							>
								{column.label}
							</DropdownMenuItem>
						))}
					</>
				) : null}
				{hiddenComputedFieldOptions.length > 0 ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>
							<T>Computed fields</T>
						</DropdownMenuLabel>
						{hiddenComputedFieldOptions.map((option) => (
							<DropdownMenuItem
								key={option.value}
								onClick={() =>
									onAddColumn(createUsageEventComputedColumnId(option.value))
								}
							>
								{option.label}
							</DropdownMenuItem>
						))}
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
