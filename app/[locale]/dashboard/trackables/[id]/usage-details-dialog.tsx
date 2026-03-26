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
	formatCompactDateTime,
	formatRelativeTime,
} from "./display-utils";
import { LogLevelBadge } from "./log-level-badge";
import type { UsageEventRow } from "./table-types";
import { HighlightedJson } from "./components/highlighted-json";
import {
	buildGroupFilterQuery,
	buildGroupedUsageEventFilterQuery,
	buildSimilarLogsQuery,
	formatPayloadJson,
	getSourceLabel,
	parseMetadata,
} from "./utils/usage-json-helpers";
import { T, useGT } from "gt-next";

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
    const gt = useGT();
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

	const groupFilterQuery = buildGroupedUsageEventFilterQuery(usageEvent);
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
						{usageEvent.event ? usageEvent.event : <span className="text-muted-foreground font-normal"><T>&mdash;</T></span>}
					</SheetTitle>

					<div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
						<span>{formatCompactDateTime(usageEvent.lastOccurredAt)}</span>
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
										title={gt("Copy ID")}
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
											
                                            											<T>ID:</T>
                                            										</span>
										<span className="font-mono">{singleHit.id}</span>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-6 w-6 shrink-0"
										onClick={() => void handleCopy(singleHit.id, "event-id")}
										title={gt("Copy ID")}
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
								
                                								<T>Similar Logs</T>
                                							</Button>
						)}
					</div>
				</SheetHeader>

				{isGroupedRow ? (
					<div className="flex-1 overflow-y-auto bg-background p-6">
						<div className="flex flex-col gap-3">
							<h3 className="text-sm font-medium text-foreground tracking-tight">
								
                                								<T>Group Filter</T>
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
									
                                    									<T>View all logs in group</T>
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
								</Button>
								<pre className="p-6 text-[13px] leading-relaxed overflow-x-auto text-foreground/90 font-mono min-h-full pb-10">
									<code>
										<HighlightedJson json={prettyJson} />
									</code>
								</pre>
							</>
						) : (
							<div className="px-6 py-6 text-sm text-muted-foreground">
								
                                        								<T>No payload data available.</T>
                                        							</div>
						)}
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
