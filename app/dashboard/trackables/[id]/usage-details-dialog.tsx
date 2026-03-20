"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { UsageEventUrlState } from "@/lib/usage-event-search";
import { cn } from "@/lib/utils";

import { formatDateTime, formatRelativeTime } from "./display-utils";
import type { UsageEventRow } from "./table-types";

export function UsageDetailsDialog({
	usageEvent,
	onFilterToGroup,
	open,
	onOpenChange,
}: {
	usageEvent: UsageEventRow;
	onFilterToGroup: (patch: Partial<UsageEventUrlState>) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [copied, setCopied] = useState(false);
	const isGroupedRow =
		usageEvent.aggregation === "payload_field" &&
		Boolean(usageEvent.groupField);
	const singleHit = usageEvent.hits[0] ?? null;
	const prettyPayload = singleHit ? formatPayloadJson(singleHit.payload) : null;
	const groupFilterQuery = isGroupedRow
		? buildGroupFilterQuery(
				usageEvent.groupField!,
				usageEvent.hits[0]?.payload[usageEvent.groupField!],
			)
		: null;

	async function handleCopyPayload() {
		if (!prettyPayload) {
			return;
		}

		await navigator.clipboard.writeText(prettyPayload);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
				<SheetHeader className="gap-4 border-b px-6 py-6">
					<SheetTitle className="truncate pr-10 font-bold text-xl flex items-center gap-4">
						<span
							className={cn(
								"size-2 rounded-full",
								usageEvent.statusTone === "error" && "bg-red-500",
								usageEvent.statusTone === "ok" && "bg-emerald-500",
								usageEvent.statusTone === "warning" && "bg-amber-500",
								usageEvent.statusTone === "neutral" && "bg-slate-400",
							)}
						/>
						{usageEvent.event ??
							(isGroupedRow ? "Grouped event" : "Untitled event")}
					</SheetTitle>
					{isGroupedRow ? (
						<>
							<SheetDescription>
								{usageEvent.totalHits} hits, last seen{" "}
								{formatRelativeTime(usageEvent.lastOccurredAt)}
							</SheetDescription>
							<div className="text-sm text-muted-foreground">
								{formatDateTime(usageEvent.lastOccurredAt)}
							</div>
						</>
					) : (
						<div className="">
							<div className="space-y-2">
								<pre className="overflow-x-auto rounded-lg border bg-muted/40 p-2 w-full text-sm  text-foreground whitespace-pre-wrap break-words">
									<code>
										{usageEvent.message?.trim() ? usageEvent.message : "—"}
									</code>
								</pre>
							</div>
							<div className="text-sm pt-4 text-muted-foreground">
								<p>Last hit {formatRelativeTime(usageEvent.lastOccurredAt)}</p>
								<p>{formatDateTime(usageEvent.lastOccurredAt)}</p>
							</div>
						</div>
					)}
				</SheetHeader>

				{isGroupedRow && groupFilterQuery ? (
					<div className="flex flex-col gap-4 border-t px-6 py-5">
						<div className="space-y-2">
							<h3 className="text-sm font-semibold">Filter by this group</h3>
							<p className="text-sm text-muted-foreground">
								Apply this query to switch back to individual events for this
								grouped value.
							</p>
						</div>
						<pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-6 text-foreground">
							<code>{groupFilterQuery}</code>
						</pre>
						<Button
							type="button"
							className="w-full"
							onClick={() => {
								onFilterToGroup({
									q: groupFilterQuery,
									aggregate: undefined,
								});
								onOpenChange(false);
							}}
						>
							Show matching events
						</Button>
					</div>
				) : null}

				{!isGroupedRow && prettyPayload ? (
					<div className="flex min-h-0 flex-1 flex-col gap-4 border-t px-6 py-5">
						<div className="space-y-1">
							<h3 className="text-sm font-semibold">Raw payload</h3>
							<p className="text-sm text-muted-foreground">
								Original event data captured for this log.
							</p>
						</div>
						<div className="min-h-0 flex-1">
							<div className="relative h-fit max-h-full overflow-auto rounded-lg border bg-muted/40">
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="absolute top-3 right-3 z-10 size-8 shrink-0 rounded-md border bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70"
									onClick={() => void handleCopyPayload()}
									aria-label={copied ? "Payload copied" : "Copy payload"}
								>
									{copied ? (
										<Check className="size-4" />
									) : (
										<Copy className="size-4" />
									)}
								</Button>
								<pre className="overflow-x-auto p-4 pr-14 text-xs leading-6 text-foreground">
									<code>
										<HighlightedJson json={prettyPayload} />
									</code>
								</pre>
							</div>
						</div>
					</div>
				) : null}
			</SheetContent>
		</Sheet>
	);
}

function buildGroupFilterQuery(field: string, value: unknown) {
	if (value === null || value === undefined) {
		return `${field}:null`;
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
		`[${inlineValues.join(", ")}]`.length <= 60;

	if (canInline) {
		return `[${inlineValues.join(", ")}]`;
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

type JsonToken = {
	value: string;
	className?: string;
};

function tokenizeJson(json: string) {
	const tokens: JsonToken[] = [];
	const pattern =
		/("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?=\s*:)?|"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:])/g;
	let cursor = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(json)) !== null) {
		const [value] = match;
		const start = match.index;

		if (start > cursor) {
			tokens.push({ value: json.slice(cursor, start) });
		}

		tokens.push({
			value,
			className: getJsonTokenClassName(value),
		});

		cursor = start + value.length;
	}

	if (cursor < json.length) {
		tokens.push({ value: json.slice(cursor) });
	}

	return tokens;
}

function getJsonTokenClassName(value: string) {
	if (value === "true" || value === "false") {
		return "text-amber-700 dark:text-amber-300";
	}

	if (value === "null") {
		return "text-rose-700 dark:text-rose-300";
	}

	if (/^-?\d/.test(value)) {
		return "text-sky-700 dark:text-sky-300";
	}

	if (/^"/.test(value)) {
		return cn(
			/\s*:$/.test(value)
				? "font-medium text-violet-700 dark:text-violet-300"
				: "text-emerald-700 dark:text-emerald-300",
		);
	}

	if (/^[{}[\],:]$/.test(value)) {
		return "text-muted-foreground";
	}

	return undefined;
}
