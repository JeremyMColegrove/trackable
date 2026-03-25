"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { EyeOff, Rows3 } from "lucide-react";

import {
	VirtualDataTableColumnHeader,
	type VirtualDataTableMenuItem,
} from "@/components/ui/virtual-data-table-column-header";
import {
	createUsageEventComputedColumnId,
	getUsageEventComputedColumnField,
	isUsageEventBuiltInColumnId,
	type UsageEventBuiltInColumnId,
	type UsageEventVisibleColumnId,
} from "@/lib/usage-event-search";

import {
	formatCompactDateTime,
	formatStatusLabel,
	formatUsageFieldLabel,
	formatUsageFieldValue,
} from "./display-utils";
import { LogLevelBadge } from "./log-level-badge";
import type {
	UsageEventColumn,
	UsageEventRow,
	UsageEventVisibleColumn,
} from "./table-types";

type UsageEventColumnOptions = {
	enableGroupByActions?: boolean;
	availableAggregateFields?: string[];
	onGroupByField?: (field: string) => void;
	onRemoveColumn?: (columnId: UsageEventVisibleColumn["id"]) => void;
	canRemoveColumn?: (column: UsageEventVisibleColumn) => boolean;
	headerTrailingContent?: React.ReactNode;
};

type UsageEventTableMode = "flat" | "grouped";
const MIN_RESIZABLE_COLUMN_SIZE_PX = 16;
const COLUMN_HEADER_BASE_MIN_SIZE_PX = 72;
const COLUMN_HEADER_CHARACTER_WIDTH_PX = 7.5;
const COLUMN_HEADER_CHROME_WIDTH_PX = 48;

const columnAggregateFieldCandidates: Partial<
	Record<UsageEventBuiltInColumnId, string[]>
> = {
	event: ["event"],
	level: ["level"],
	message: ["message", "msg"],
};

const usageEventColumnDefinitions: Record<
	UsageEventBuiltInColumnId,
	ColumnDef<UsageEventRow>
> = {
	lastOccurredAt: {
		accessorKey: "lastOccurredAt",
		size: 176,
		minSize: MIN_RESIZABLE_COLUMN_SIZE_PX,
		header: ({ column }) => (
			<VirtualDataTableColumnHeader column={column} title="Timestamp" />
		),
		cell: ({ row }) => (
			<span className="whitespace-nowrap text-muted-foreground">
				{formatCompactDateTime(row.original.lastOccurredAt)}
			</span>
		),
		meta: {
			export: {
				label: "Timestamp",
				getValue: ({ row }) => formatCompactDateTime(row.lastOccurredAt),
			},
		},
	},
	event: {
		id: "event",
		accessorFn: (row) => row.event ?? "",
		size: 104,
		minSize: MIN_RESIZABLE_COLUMN_SIZE_PX,
		header: ({ column }) => (
			<VirtualDataTableColumnHeader column={column} title="Event" />
		),
		cell: ({ row }) => (
			<div className="min-w-0">
				<span
					className="block truncate font-medium"
					title={row.original.event ?? undefined}
				>
					{formatCompactEvent(row.original.event)}
				</span>
			</div>
		),
		sortingFn: (left, right) =>
			(left.original.event ?? "").localeCompare(right.original.event ?? ""),
		filterFn: (row, _columnId, filterValue) => {
			return (row.original.event ?? "")
				.toLowerCase()
				.includes(String(filterValue).toLowerCase());
		},
		meta: {
			export: {
				label: "Event",
				getValue: ({ row }) => formatCompactEvent(row.event),
			},
		},
	},
	level: {
		id: "level",
		accessorFn: (row) => row.level ?? "",
		size: 88,
		minSize: MIN_RESIZABLE_COLUMN_SIZE_PX,
		header: ({ column }) => (
			<VirtualDataTableColumnHeader column={column} title="Level" />
		),
		cell: ({ row }) => <LogLevelBadge level={row.original.level} />,
		sortingFn: (left, right) =>
			(left.original.level ?? "").localeCompare(right.original.level ?? ""),
		meta: {
			export: {
				label: "Level",
				getValue: ({ row }) => (row.level ? formatStatusLabel(row.level) : "—"),
			},
		},
	},
	message: {
		id: "message",
		accessorFn: (row) => row.message ?? "",
		size: 320,
		minSize: MIN_RESIZABLE_COLUMN_SIZE_PX,
		header: ({ column }) => (
			<VirtualDataTableColumnHeader column={column} title="Message" />
		),
		cell: ({ row }) => (
			<div className="max-w-full min-w-0">
				<span className="block truncate text-sm text-muted-foreground">
					{row.original.message ?? "—"}
				</span>
			</div>
		),
		sortingFn: (left, right) =>
			(left.original.message ?? "").localeCompare(right.original.message ?? ""),
		meta: {
			virtualTable: {
				cellClassName: "w-full max-w-0",
				headerClassName: "w-full max-w-0",
			},
			export: {
				label: "Message",
				getValue: ({ row }) => row.message ?? "—",
			},
		},
	},
	totalHits: {
		accessorKey: "totalHits",
		size: 72,
		minSize: MIN_RESIZABLE_COLUMN_SIZE_PX,
		header: ({ column }) => (
			<VirtualDataTableColumnHeader column={column} title="Hits" />
		),
		cell: ({ row }) => (
			<span className="font-medium">{row.original.totalHits}</span>
		),
		meta: {
			export: {
				label: "Hits",
				getValue: ({ row }) => String(row.totalHits),
			},
		},
	},
	firstOccurredAt: {
		accessorKey: "firstOccurredAt",
		size: 176,
		minSize: MIN_RESIZABLE_COLUMN_SIZE_PX,
		header: ({ column }) => (
			<VirtualDataTableColumnHeader column={column} title="First Seen" />
		),
		cell: ({ row }) => (
			<span className="whitespace-nowrap text-muted-foreground">
				{formatCompactDateTime(row.original.firstOccurredAt)}
			</span>
		),
		meta: {
			export: {
				label: "First Seen",
				getValue: ({ row }) => formatCompactDateTime(row.firstOccurredAt),
			},
		},
	},
	percentage: {
		accessorKey: "percentage",
		size: 64,
		minSize: MIN_RESIZABLE_COLUMN_SIZE_PX,
		header: ({ column }) => (
			<VirtualDataTableColumnHeader column={column} title="%" />
		),
		cell: ({ row }) => (
			<span className="font-medium">
				{formatPercentage(row.original.percentage)}
			</span>
		),
		sortingFn: (left, right) =>
			left.original.percentage - right.original.percentage,
		meta: {
			export: {
				label: "%",
				getValue: ({ row }) => formatPercentage(row.percentage),
			},
		},
	},
};

export function getUsageEventColumns(
	columns: UsageEventVisibleColumn[],
	options: UsageEventColumnOptions = {},
): ColumnDef<UsageEventRow>[] {
	const visibleColumns = columns.filter((column) => column.visible);
	const availableAggregateFields = options.availableAggregateFields ?? [];
	const tableMode: UsageEventTableMode = columns.some(
		(column) => column.id === "totalHits",
	)
		? "grouped"
		: "flat";

	return visibleColumns.map((column, index) => {
		const definition = isComputedUsageEventColumn(column)
			? buildComputedUsageEventColumnDefinition(column)
			: usageEventColumnDefinitions[column.id];
		const aggregateField = isComputedUsageEventColumn(column)
			? column.field
			: resolveAggregateField(column.id, availableAggregateFields);
		const menuItems = buildColumnMenuItems(column, aggregateField, options);
		const headerTrailingContent =
			index === visibleColumns.length - 1
				? options.headerTrailingContent
				: null;
		const titleMinSize = getColumnTitleMinSize(column.label);
		const columnSizingOverrides = getColumnSizingOverrides(
			tableMode,
			visibleColumns.length,
			titleMinSize,
		);

		return {
			...definition,
			...columnSizingOverrides,
			minSize: Math.max(definition.minSize ?? 0, titleMinSize),
			meta: {
				...definition.meta,
				export: {
					...definition.meta?.export,
					label: column.label,
				},
				virtualTable: {
					...definition.meta?.virtualTable,
					...getColumnVirtualTableOverrides(column, tableMode),
				},
			},
			header: ({ column: tableColumn }) => (
				<VirtualDataTableColumnHeader
					column={tableColumn}
					title={column.label}
					menuItems={menuItems}
					trailingContent={headerTrailingContent}
				/>
			),
		} as ColumnDef<UsageEventRow>;
	});
}

export function getDefaultUsageEventVisibleColumnIds(
	columns: UsageEventColumn[],
) {
	return columns
		.filter((column) => column.visible)
		.map((column) => column.id as UsageEventVisibleColumnId);
}

export function resolveUsageEventVisibleColumns(
	columns: UsageEventColumn[],
	visibleColumnIds: UsageEventVisibleColumnId[],
) {
	if (visibleColumnIds.length === 0) {
		return columns.filter((column) => column.visible);
	}

	const builtInColumnMap = new Map(
		columns.map((column) => [column.id, column] as const),
	);
	const currentModeBuiltInColumnIds = visibleColumnIds.filter(
		(columnId): columnId is UsageEventBuiltInColumnId =>
			isUsageEventBuiltInColumnId(columnId) && builtInColumnMap.has(columnId),
	);
	const shouldUseExplicitBuiltInColumns =
		currentModeBuiltInColumnIds.length > 0;
	const resolvedColumns: UsageEventVisibleColumn[] =
		shouldUseExplicitBuiltInColumns
			? currentModeBuiltInColumnIds
					.map((columnId) => builtInColumnMap.get(columnId))
					.filter((column): column is UsageEventColumn => Boolean(column))
					.map((column) => ({
						...column,
						visible: true,
					}))
			: columns
					.filter((column) => column.visible)
					.map((column) => ({
						...column,
						visible: true,
					}));

	for (const columnId of visibleColumnIds) {
		if (isUsageEventBuiltInColumnId(columnId)) {
			continue;
		}

		const computedField = getUsageEventComputedColumnField(columnId);

		if (!computedField) {
			continue;
		}

		resolvedColumns.push({
			id: createUsageEventComputedColumnId(computedField),
			field: computedField,
			kind: "computed",
			label: formatUsageFieldLabel(computedField),
			visible: true,
		});
	}

	return resolvedColumns;
}

function resolveAggregateField(
	columnId: UsageEventBuiltInColumnId,
	availableAggregateFields: string[],
) {
	const candidates = columnAggregateFieldCandidates[columnId];

	if (!candidates) {
		return null;
	}

	return (
		candidates.find((candidate) =>
			availableAggregateFields.includes(candidate),
		) ?? null
	);
}

function formatPercentage(value: number) {
	const roundedValue = Number.isInteger(value)
		? String(value)
		: value.toFixed(1);

	return `${roundedValue}%`;
}

function formatCompactEvent(value: string | null) {
	const trimmedValue = value?.trim();

	if (!trimmedValue) {
		return "—";
	}

	return trimmedValue.split(/\s+/, 1)[0] ?? trimmedValue;
}

function getColumnSizingOverrides(
	tableMode: UsageEventTableMode,
	visibleColumnCount: number,
	titleMinSize: number,
) {
	if (tableMode !== "grouped") {
		return {};
	}

	return {
		size: Math.max(getGroupedColumnSize(visibleColumnCount), titleMinSize),
		minSize: titleMinSize,
	};
}

function getColumnVirtualTableOverrides(
	column: UsageEventVisibleColumn,
	tableMode: UsageEventTableMode,
) {
	if (tableMode === "flat") {
		return {};
	}

	switch (column.id) {
		case "event":
			return {
				cellClassName: "w-full max-w-0",
				headerClassName: "w-full max-w-0",
			};
		default:
			return {};
	}
}

function buildColumnMenuItems(
	column: UsageEventVisibleColumn,
	aggregateField: string | null,
	options: UsageEventColumnOptions,
) {
	const menuItems: VirtualDataTableMenuItem[] = [];

	if (
		options.enableGroupByActions &&
		aggregateField &&
		options.onGroupByField
	) {
		menuItems.push({
			id: `group-by-${aggregateField}`,
			label: `Group by ${column.label}`,
			icon: <Rows3 className="size-4" />,
			onClick: () => options.onGroupByField?.(aggregateField),
		});
	}

	if (options.onRemoveColumn && options.canRemoveColumn?.(column)) {
		menuItems.push({
			id: `remove-column-${column.id}`,
			label: "Hide column",
			icon: <EyeOff className="size-4" />,
			onClick: () => options.onRemoveColumn?.(column.id),
			separator: menuItems.length > 0,
		});
	}

	return menuItems.length > 0 ? menuItems : undefined;
}

function buildComputedUsageEventColumnDefinition(
	column: Extract<UsageEventVisibleColumn, { kind: "computed" }>,
): ColumnDef<UsageEventRow> {
	return {
		id: column.id,
		accessorFn: (row) => getUsageEventComputedFieldSummary(row, column.field),
		size: 192,
		minSize: MIN_RESIZABLE_COLUMN_SIZE_PX,
		cell: ({ row }) => (
			<div className="max-w-full min-w-0">
				<span
					className="block truncate text-sm text-muted-foreground"
					title={getUsageEventComputedFieldSummary(row.original, column.field)}
				>
					{getUsageEventComputedFieldSummary(row.original, column.field)}
				</span>
			</div>
		),
		meta: {
			virtualTable: {
				cellClassName: "w-full max-w-0",
				headerClassName: "w-full max-w-0",
			},
			export: {
				label: column.label,
				getValue: ({ row }) =>
					getUsageEventComputedFieldSummary(row, column.field),
			},
		},
	};
}

function isComputedUsageEventColumn(
	column: UsageEventVisibleColumn,
): column is Extract<UsageEventVisibleColumn, { kind: "computed" }> {
	return "kind" in column && column.kind === "computed";
}

function getUsageEventComputedFieldSummary(row: UsageEventRow, field: string) {
	if (row.aggregation === "payload_field" && row.groupField === field) {
		return row.event?.trim() || "—";
	}

	const uniqueValues = new Set<string>();
	const orderedValues: string[] = [];

	for (const hit of row.hits) {
		const formattedValue = formatUsageFieldValue(hit.payload[field]).trim();

		if (!formattedValue || uniqueValues.has(formattedValue)) {
			continue;
		}

		uniqueValues.add(formattedValue);
		orderedValues.push(formattedValue);
	}

	if (orderedValues.length === 0) {
		return "—";
	}

	if (orderedValues.length <= 3) {
		return orderedValues.join(", ");
	}

	return `${orderedValues.slice(0, 3).join(", ")} +${orderedValues.length - 3} more`;
}

function getGroupedColumnSize(visibleColumnCount: number) {
	const safeVisibleColumnCount = Math.max(visibleColumnCount, 1);

	return Math.max(
		Math.round(960 / safeVisibleColumnCount),
		MIN_RESIZABLE_COLUMN_SIZE_PX,
	);
}

function getColumnTitleMinSize(label: string) {
	return Math.max(
		COLUMN_HEADER_BASE_MIN_SIZE_PX,
		Math.ceil(
			label.length * COLUMN_HEADER_CHARACTER_WIDTH_PX +
				COLUMN_HEADER_CHROME_WIDTH_PX,
		),
	);
}
