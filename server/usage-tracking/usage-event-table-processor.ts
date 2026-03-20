import "server-only";

import { TRPCError } from "@trpc/server";
import { type LiqeQuery, parse, test } from "liqe";

import type {
	UsageEventAggregation,
	UsageEventSearchInput,
	UsageEventSourceSnapshot,
	UsageEventTableApiKey,
	UsageEventTableResult,
} from "@/lib/usage-event-search";

type UsageEventRecord = {
	id: string;
	occurredAt: Date;
	payload: Record<string, unknown>;
	metadata: string | null;
	apiKey: UsageEventTableApiKey;
};

type UsageEventGroup = {
	id: string;
	event: string;
	status: string | null;
	statusTone: "error" | "ok" | "warning" | "neutral";
	message: string | null;
	aggregation: UsageEventAggregation;
	groupField: string | null;
	totalHits: number;
	lastOccurredAt: string;
	apiKey: UsageEventTableApiKey | null;
	apiKeyCount: number;
	apiKeys: UsageEventTableApiKey[];
	hits: UsageEventTableResult["rows"][number]["hits"];
};

function extractPayloadString(
	payload: Record<string, unknown>,
	key: string,
): string | null {
	const value = payload[key];

	if (typeof value === "string" && value.trim()) {
		return value.trim();
	}

	return null;
}

function resolveStatusTone(status: string | null) {
	switch (status?.trim().toLowerCase()) {
		case "error":
			return "error" as const;
		case "ok":
			return "ok" as const;
		case "warning":
			return "warning" as const;
		default:
			return "neutral" as const;
	}
}

function parseMetadata(metadata: string | null) {
	if (!metadata) {
		return null;
	}

	try {
		return JSON.parse(metadata) as unknown;
	} catch {
		return metadata;
	}
}

function formatFieldLabel(value: string) {
	return value
		.replace(/[_-]+/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^./, (char) => char.toUpperCase());
}

function serializeAggregateValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "__empty__";
	}

	if (typeof value === "string") {
		return value.trim() || "__empty__";
	}

	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return String(value);
	}

	return JSON.stringify(value);
}

function formatAggregateValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "Empty";
	}

	if (typeof value === "string") {
		return value.trim() || "Empty";
	}

	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return String(value);
	}

	if (Array.isArray(value)) {
		const formattedValue = value
			.map((entry): string => formatAggregateValue(entry))
			.filter(Boolean)
			.join(", ");

		return formattedValue || "Empty";
	}

	return JSON.stringify(value);
}

function buildSearchableSubject(event: UsageEventRecord) {
	return {
		...event.payload,
		occurredAt: event.occurredAt.toISOString(),
		apiKey: event.apiKey,
		metadata: parseMetadata(event.metadata),
	};
}

function applyQueryFilter(events: UsageEventRecord[], query: string) {
	const normalizedQuery = query.trim();

	if (!normalizedQuery) {
		return events;
	}

	let parsedQuery: LiqeQuery;

	try {
		parsedQuery = parse(normalizedQuery);
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: error instanceof Error ? error.message : "Invalid liqe query.",
		});
	}

	return events.filter((event) =>
		test(parsedQuery, buildSearchableSubject(event)),
	);
}

function applyTimeRangeFilter(
	events: UsageEventRecord[],
	input: UsageEventSearchInput,
) {
	return events.filter((event) => {
		const occurredAtTime = event.occurredAt.getTime();

		if (input.from && occurredAtTime < new Date(input.from).getTime()) {
			return false;
		}

		if (input.to && occurredAtTime > new Date(input.to).getTime()) {
			return false;
		}

		return true;
	});
}

function buildColumns(aggregation: UsageEventAggregation) {
	if (aggregation === "payload_field") {
		return [
			{ id: "event" as const, label: "Aggregate Value", visible: true },
			{ id: "lastOccurredAt" as const, label: "Last Hit", visible: true },
			{ id: "totalHits" as const, label: "Total Hits", visible: true },
		];
	}

	return [
		{ id: "event" as const, label: "Event", visible: true },
		{ id: "status" as const, label: "Status", visible: true },
		{ id: "message" as const, label: "Message", visible: true },
		{ id: "lastOccurredAt" as const, label: "Last Hit", visible: true },
	];
}

function collectAvailableAggregateFields(events: UsageEventRecord[]) {
	const fields = new Set<string>();

	for (const event of events) {
		for (const key of Object.keys(event.payload)) {
			fields.add(key);
		}
	}

	return Array.from(fields).sort((left, right) => left.localeCompare(right));
}

export class UsageEventTableProcessor {
	constructor(
		private readonly events: UsageEventRecord[],
		private readonly input: UsageEventSearchInput,
		private readonly sourceSnapshot: UsageEventSourceSnapshot,
	) {}

	process(): UsageEventTableResult {
		const timeRangeFilteredEvents = applyTimeRangeFilter(this.events, this.input);
		const filteredEvents = applyQueryFilter(timeRangeFilteredEvents, this.input.query);
		const availableAggregateFields = collectAvailableAggregateFields(this.events);

		if (this.input.aggregation === "none" || !this.input.aggregateField) {
			const sortedRows = filteredEvents
				.map((event) => {
					const occurredAt = event.occurredAt.toISOString();
					const eventName = extractPayloadString(event.payload, "event");
					const status = extractPayloadString(event.payload, "status");
					const hit = {
						id: event.id,
						occurredAt,
						payload: event.payload,
						metadata: event.metadata,
						apiKey: event.apiKey,
					};

					return {
						id: event.id,
						event: eventName,
						status,
						statusTone: resolveStatusTone(status),
						message: extractPayloadString(event.payload, "msg"),
						aggregation: this.input.aggregation,
						groupField: null,
						totalHits: 1,
						lastOccurredAt: occurredAt,
						apiKey: event.apiKey,
						apiKeyCount: 1,
						apiKeys: [event.apiKey],
						hits: [hit],
					};
				})
				.sort((left, right) => {
					switch (this.input.sort) {
						case "event":
							return this.input.dir === "asc"
								? (left.event ?? "").localeCompare(right.event ?? "")
								: (right.event ?? "").localeCompare(left.event ?? "");
						case "totalHits":
							return this.input.dir === "asc"
								? left.totalHits - right.totalHits
								: right.totalHits - left.totalHits;
						case "lastOccurredAt":
						default:
							return this.input.dir === "asc"
								? new Date(left.lastOccurredAt).getTime() -
										new Date(right.lastOccurredAt).getTime()
								: new Date(right.lastOccurredAt).getTime() -
										new Date(left.lastOccurredAt).getTime();
					}
				});

			const rows = sortedRows.slice(0, this.input.limit);

			return {
				columns: buildColumns(this.input.aggregation),
				rows,
				totalMatchedEvents: filteredEvents.length,
				totalGroupedRows: sortedRows.length,
				availableAggregateFields,
				sourceSnapshot: this.sourceSnapshot,
			};
		}

		const groups = new Map<string, UsageEventGroup>();
		const groupFieldLabel = formatFieldLabel(this.input.aggregateField);

		for (const event of filteredEvents) {
			const aggregateValue = formatAggregateValue(
				event.payload[this.input.aggregateField],
			);
			const groupId = `${this.input.aggregateField}:${serializeAggregateValue(
				event.payload[this.input.aggregateField],
			)}`;

			const existingGroup = groups.get(groupId);
			const occurredAt = event.occurredAt.toISOString();
			const hit = {
				id: event.id,
				occurredAt,
				payload: event.payload,
				metadata: event.metadata,
				apiKey: event.apiKey,
			};

			if (existingGroup) {
				existingGroup.totalHits += 1;
				existingGroup.hits.push(hit);

				if (
					new Date(existingGroup.lastOccurredAt).getTime() <
					event.occurredAt.getTime()
				) {
					existingGroup.lastOccurredAt = occurredAt;
				}

				if (
					!existingGroup.apiKeys.some((apiKey) => apiKey.id === event.apiKey.id)
				) {
					existingGroup.apiKeys.push(event.apiKey);
					existingGroup.apiKeyCount = existingGroup.apiKeys.length;
				}

				continue;
			}

			groups.set(groupId, {
				id: groupId,
				event: aggregateValue,
				status: null,
				statusTone: "neutral",
				message: null,
				aggregation: this.input.aggregation,
				groupField: this.input.aggregateField,
				totalHits: 1,
				lastOccurredAt: occurredAt,
				apiKey: null,
				apiKeyCount: 1,
				apiKeys: [event.apiKey],
				hits: [hit],
			});
		}

		const sortedRows = Array.from(groups.values())
			.map((group) => ({
				...group,
				hits: [...group.hits].sort(
					(left, right) =>
						new Date(right.occurredAt).getTime() -
						new Date(left.occurredAt).getTime(),
				),
				apiKeys: [...group.apiKeys].sort((left, right) =>
					left.name.localeCompare(right.name),
				),
			}))
			.sort((left, right) => {
				switch (this.input.sort) {
					case "event":
						return this.input.dir === "asc"
							? left.event.localeCompare(right.event)
							: right.event.localeCompare(left.event);
					case "totalHits":
						return this.input.dir === "asc"
							? left.totalHits - right.totalHits ||
									left.event.localeCompare(right.event)
							: right.totalHits - left.totalHits ||
									right.event.localeCompare(left.event);
					case "lastOccurredAt":
					default:
						return this.input.dir === "asc"
							? new Date(left.lastOccurredAt).getTime() -
									new Date(right.lastOccurredAt).getTime() ||
									left.event.localeCompare(right.event)
							: new Date(right.lastOccurredAt).getTime() -
									new Date(left.lastOccurredAt).getTime() ||
									right.event.localeCompare(left.event);
				}
			});

		const rows = sortedRows.slice(0, this.input.limit);

		return {
			columns: buildColumns(this.input.aggregation).map((column) =>
				column.id === "event"
					? {
							...column,
							label: groupFieldLabel,
						}
					: column,
			),
			rows,
			totalMatchedEvents: filteredEvents.length,
			totalGroupedRows: sortedRows.length,
			availableAggregateFields,
			sourceSnapshot: this.sourceSnapshot,
		};
	}
}
