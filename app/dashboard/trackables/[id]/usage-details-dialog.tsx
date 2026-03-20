"use client";

import { Check, Copy, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { UsageEventUrlState } from "@/lib/usage-event-search";

import {
	formatDateTime,
	formatRelativeTime,
	formatUsageFieldLabel,
} from "./display-utils";
import { LogLevelBadge } from "./log-level-badge";
import type { UsageEventRow } from "./table-types";

export function UsageDetailsDialog({
	usageEvent,
	onFilterToGroup,
	onApplyFilters,
	open,
	onOpenChange,
}: {
	usageEvent: UsageEventRow;
	onFilterToGroup: (patch: Partial<UsageEventUrlState>) => void;
	onApplyFilters: (patch: Partial<UsageEventUrlState>) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [copiedAction, setCopiedAction] = useState<
		"event-id" | "raw-json" | null
	>(null);
	const isGroupedRow =
		usageEvent.aggregation === "payload_field" &&
		Boolean(usageEvent.groupField);
	const singleHit = usageEvent.hits[0] ?? null;
	const metadata = useMemo(
		() => parseMetadata(singleHit?.metadata ?? null),
		[singleHit],
	);
	const payload = singleHit?.payload ?? {};

	const combinedData = singleHit
		? {
				...payload,
				_metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
			}
		: null;

	const prettyJson = combinedData ? formatPayloadJson(combinedData) : null;

	const groupValue = isGroupedRow
		? usageEvent.hits[0]?.payload[usageEvent.groupField!]
		: undefined;
	const groupFilterQuery = isGroupedRow
		? buildGroupFilterQuery(usageEvent.groupField!, groupValue)
		: null;
	const similarLogsQuery = buildSimilarLogsQuery(usageEvent, metadata);
	const sourceLabel = getSourceLabel(usageEvent);

	async function handleCopy(value: string, action: "event-id" | "raw-json") {
		await navigator.clipboard.writeText(value);
		setCopiedAction(action);
		window.setTimeout(
			() => setCopiedAction((current) => (current === action ? null : current)),
			2000,
		);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full gap-0 p-0 sm:max-w-2xl flex flex-col overflow-y-auto"
			>
				<SheetHeader className="gap-0 border-b bg-muted/10 px-6 py-6">
					<div className="flex flex-wrap items-center gap-2 mb-3">
						{!isGroupedRow ? <LogLevelBadge level={usageEvent.level} /> : null}
						<Badge
							variant="secondary"
							className="rounded-md px-2 py-0.5 font-medium shadow-none text-muted-foreground bg-muted"
						>
							{sourceLabel}
						</Badge>
					</div>

					<SheetTitle className="text-xl font-medium tracking-tight mb-2 flex items-center h-7">
						{usageEvent.event ? usageEvent.event : <span className="text-muted-foreground font-normal">&mdash;</span>}
					</SheetTitle>

					<div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
						<span>{formatDateTime(usageEvent.lastOccurredAt)}</span>
						<span className="text-border">•</span>
						<span>
							{isGroupedRow
								? `${usageEvent.totalHits} hits in this group`
								: formatRelativeTime(usageEvent.lastOccurredAt)}
						</span>
					</div>

					{singleHit && !isGroupedRow && (
						<div className="mb-4 flex flex-col gap-2 rounded-md bg-muted/30 p-3 border border-border/50">
							{usageEvent.message?.trim() && (
								<div className="flex items-center justify-between">
									<div className="text-sm text-foreground whitespace-pre-wrap">
										{usageEvent.message.trim()}
									</div>

									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-6 w-6 shrink-0 ml-4"
										onClick={() => void handleCopy(singleHit.id, "event-id")}
										title="Copy ID"
									>
										{copiedAction === "event-id" ? (
											<Check className="size-3.5" />
										) : (
											<Copy className="size-3.5 text-muted-foreground" />
										)}
									</Button>
								</div>
							)}
							{!usageEvent.message?.trim() && (
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-sm">
										<span className="font-medium text-muted-foreground">
											ID:
										</span>
										<span className="font-mono">{singleHit.id}</span>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-6 w-6 shrink-0"
										onClick={() => void handleCopy(singleHit.id, "event-id")}
										title="Copy ID"
									>
										{copiedAction === "event-id" ? (
											<Check className="size-3.5" />
										) : (
											<Copy className="size-3.5 text-muted-foreground" />
										)}
									</Button>
								</div>
							)}
						</div>
					)}

					<div className="flex items-center gap-2">
						{similarLogsQuery && !isGroupedRow && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 gap-1.5 text-xs bg-background shadow-xs hover:bg-muted"
								onClick={() => {
									onFilterToGroup({
										q: similarLogsQuery,
										aggregate: undefined,
									});
								}}
							>
								<Search className="size-3.5 text-muted-foreground" />
								Similar Logs
							</Button>
						)}
					</div>
				</SheetHeader>

				{isGroupedRow ? (
					<div className="flex-1 overflow-y-auto bg-background p-6">
						<div className="flex flex-col gap-3">
							<h3 className="text-sm font-medium text-foreground tracking-tight">
								Group Filter
							</h3>
							<div className="rounded-md border border-border/50 bg-muted/30 p-3 text-sm font-mono text-foreground">
								{groupFilterQuery}
							</div>
							<div>
								<Button
									type="button"
									variant="outline"
									className="w-full justify-center gap-2"
									onClick={() => {
										if (groupFilterQuery) {
											onFilterToGroup({
												q: groupFilterQuery,
												aggregate: undefined,
											});
										}
									}}
								>
									<Search className="size-4 text-muted-foreground" />
									View all logs in group
								</Button>
							</div>
						</div>
					</div>
				) : (
					<div className="bg-muted/10 relative flex-1">
						{prettyJson ? (
							<>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="absolute top-4 right-4 z-10   backdrop-blur-sm text-muted-foreground hover:bg-muted  shadow-xs"
									onClick={() => void handleCopy(prettyJson, "raw-json")}
								>
									{copiedAction === "raw-json" ? (
										<Check className="size-3.5" />
									) : (
										<Copy className="size-3.5" />
									)}
									{/* {copiedAction === "raw-json" ? "Copied" : "Copy JSON"} */}
								</Button>
								<pre className="p-6 text-[13px] leading-relaxed overflow-x-auto text-foreground/90 font-mono min-h-full pb-10">
									<code>
										<HighlightedJson json={prettyJson} />
									</code>
								</pre>
							</>
						) : (
							<div className="px-6 py-6 text-sm text-muted-foreground">
								No payload data available.
							</div>
						)}
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

function buildSimilarLogsQuery(
	usageEvent: UsageEventRow,
	metadata: Record<string, unknown>,
) {
	const parts: string[] = [];

	if (usageEvent.event?.trim()) {
		parts.push(`event:${quoteLiqeString(usageEvent.event.trim())}`);
	}

	if (usageEvent.level) {
		parts.push(`level:${quoteLiqeString(usageEvent.level)}`);
	}

	const route = metadata.route ?? metadata.path;
	if (typeof route === "string" && route.trim()) {
		parts.push(`route:${quoteLiqeString(route.trim())}`);
	}

	return parts.length > 0 ? parts.join(" ") : null;
}

function getSourceLabel(usageEvent: UsageEventRow) {
	if (usageEvent.apiKey?.name?.trim()) {
		return usageEvent.apiKey.name.trim();
	}

	if (usageEvent.apiKeyCount > 1) {
		return `${usageEvent.apiKeyCount} API keys`;
	}

	if (usageEvent.aggregation === "payload_field" && usageEvent.groupField) {
		return `Grouped by ${formatUsageFieldLabel(usageEvent.groupField)}`;
	}

	return "Unknown source";
}

function parseMetadata(metadata: string | null) {
	if (!metadata) {
		return {};
	}

	try {
		const parsed = JSON.parse(metadata) as unknown;
		return isPlainObject(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function buildGroupFilterQuery(field: string, value: unknown) {
	if (value === null || value === undefined) {
		return `-${field}:*`;
	}

	if (typeof value === "string") {
		const normalizedValue = value.trim();

		if (!normalizedValue) {
			return `${field}:""`;
		}

		return `${field}:${quoteLiqeString(normalizedValue)}`;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return `${field}:${String(value)}`;
	}

	return `${field}:${quoteLiqeString(JSON.stringify(value))}`;
}

function quoteLiqeString(value: string) {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function formatPayloadJson(value: unknown) {
	return formatJsonValue(value, 0);
}

function formatJsonValue(value: unknown, depth: number): string {
	if (Array.isArray(value)) {
		return formatJsonArray(value, depth);
	}

	if (isPlainObject(value)) {
		return formatJsonObject(value, depth);
	}

	return JSON.stringify(value);
}

function formatJsonArray(value: unknown[], depth: number) {
	if (value.length === 0) {
		return "[]";
	}

	const inlineValues = value.map((item) =>
		isInlineJsonValue(item) ? JSON.stringify(item) : null,
	);
	const canInline =
		inlineValues.every((item) => item !== null) &&
		`[${inlineValues.join(", ")}]`.length <= 80;

	if (canInline) {
		return `[ ${inlineValues.join(", ")} ]`;
	}

	const indent = "  ".repeat(depth);
	const nextIndent = "  ".repeat(depth + 1);
	const lines = value.map(
		(item) => `${nextIndent}${formatJsonValue(item, depth + 1)}`,
	);

	return `[\n${lines.join(",\n")}\n${indent}]`;
}

function formatJsonObject(value: Record<string, unknown>, depth: number) {
	const entries = Object.entries(value);

	if (entries.length === 0) {
		return "{}";
	}

	const indent = "  ".repeat(depth);
	const nextIndent = "  ".repeat(depth + 1);
	const lines = entries.map(
		([key, entryValue]) =>
			`${nextIndent}${JSON.stringify(key)}: ${formatJsonValue(entryValue, depth + 1)}`,
	);

	return `{\n${lines.join(",\n")}\n${indent}}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInlineJsonValue(value: unknown) {
	return (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

function HighlightedJson({ json }: { json: string }) {
	return (
		<>
			{tokenizeJson(json).map((token, index) => (
				<span key={`${index}-${token.value}`} className={token.className}>
					{token.value}
				</span>
			))}
		</>
	);
}

function tokenizeJson(json: string) {
	const tokens: Array<{ value: string; className?: string }> = [];
	let index = 0;

	while (index < json.length) {
		const char = json[index];

		if (char === '"') {
			let endIndex = index + 1;
			let isEscaped = false;

			while (endIndex < json.length) {
				const currentChar = json[endIndex];
				if (currentChar === '"' && !isEscaped) {
					break;
				}
				isEscaped = currentChar === "\\" ? !isEscaped : false;
				endIndex += 1;
			}

			const value = json.slice(index, endIndex + 1);
			const remainder = json.slice(endIndex + 1);
			const className = /^\s*:/.test(remainder)
				? "text-sky-700 dark:text-sky-300"
				: "text-emerald-700 dark:text-emerald-300";

			tokens.push({ value, className });
			index = endIndex + 1;
			continue;
		}

		const literalMatch = /^(true|false|null)\b/.exec(json.slice(index));
		if (literalMatch) {
			tokens.push({
				value: literalMatch[0],
				className: "text-violet-700 dark:text-violet-300",
			});
			index += literalMatch[0].length;
			continue;
		}

		const numberMatch = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(json.slice(index));
		if (numberMatch) {
			tokens.push({
				value: numberMatch[0],
				className: "text-amber-700 dark:text-amber-300",
			});
			index += numberMatch[0].length;
			continue;
		}

		tokens.push({ value: char, className: "text-foreground/80" });
		index += 1;
	}

	return tokens;
}
