"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
	buildUsageEventSearchInput,
	buildUsageEventUrlSearchParams,
	normalizeUsageEventUrlState,
	resolveUsageEventTimeRange,
	type UsageEventTimeRange,
	type UsageEventUrlState,
} from "@/lib/usage-event-search";
import { useTrackableDetails } from "./trackable-shell";
import { UsageEventsTable, UsageEventsTableSkeleton } from "./usage-events-table";
import { formatUsageFieldLabel } from "./display-utils";
import {
	TrackablePageFrame,
	TrackableNarrowContent,
	TrackablePageSearch,
} from "./components/trackable-page-frame";
import {
	UsageSelectFilter,
	UsageTimeRangeFilter,
} from "./components/usage-filters";
import { T, useGT } from "gt-next";

export function UsageEventsPage() {
    const gt = useGT();
	const trackable = useTrackableDetails();
	const trpc = useTRPC();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [draftQuery, setDraftQuery] = useState("");
	const [draftAggregateField, setDraftAggregateField] = useState("");
	const [draftTimeRange, setDraftTimeRange] =
		useState<Exclude<UsageEventTimeRange, "custom">>("all_time");
	const [isRefreshingTable, setIsRefreshingTable] = useState(false);
	const normalizedUrlState = useMemo(
		() => normalizeUsageEventUrlState(searchParams),
		[searchParams],
	);
	const appliedQuery = normalizedUrlState.q ?? "";
	const appliedAggregateField = normalizedUrlState.aggregate ?? "";
	const appliedTimeRange = useMemo<
		Exclude<UsageEventTimeRange, "custom">
	>(() => {
		const resolvedRange = resolveUsageEventTimeRange(normalizedUrlState);

		return resolvedRange === "custom" ? "all_time" : resolvedRange;
	}, [normalizedUrlState]);
	const hasPendingQueryChange = draftQuery.trim() !== appliedQuery.trim();
	const hasPendingAggregateChange =
		draftAggregateField.trim() !== appliedAggregateField.trim();
	const hasPendingTimeRangeChange = draftTimeRange !== appliedTimeRange;
	const hasPendingTableChange =
		hasPendingQueryChange ||
		hasPendingAggregateChange ||
		hasPendingTimeRangeChange;
	const searchInput = useMemo(
		() => buildUsageEventSearchInput(trackable.id, normalizedUrlState),
		[normalizedUrlState, trackable.id],
	);
	const usageEventTableQuery = useQuery(
		trpc.trackables.getUsageEventTable.queryOptions(searchInput, {
			retry: false,
			placeholderData: (previousData) => previousData,
		}),
	);
	const groupByOptions = useMemo(
		() => [
			{ label: "None", value: "__none__" },
			...(usageEventTableQuery.data?.availableAggregateFields ?? []).map(
				(field) => ({
					label: formatUsageFieldLabel(field),
					value: field,
				}),
			),
		],
		[usageEventTableQuery.data?.availableAggregateFields],
	);

	useEffect(() => {
		setDraftQuery(appliedQuery);
	}, [appliedQuery]);

	useEffect(() => {
		setDraftAggregateField(appliedAggregateField);
	}, [appliedAggregateField]);

	useEffect(() => {
		setDraftTimeRange(appliedTimeRange);
	}, [appliedTimeRange]);

	function updateUrlState(patch: Partial<UsageEventUrlState>) {
		const nextParams = buildUsageEventUrlSearchParams({
			...normalizedUrlState,
			...patch,
		});
		const nextSearch = nextParams.toString();
		const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;

		startTransition(() => {
			router.replace(nextUrl, { scroll: false });
		});
	}

	function handleFilterToGroup(patch: Partial<UsageEventUrlState>) {
		const nextTimeRangeState =
			appliedTimeRange === "all_time"
				? {
						range: undefined,
						from: undefined,
						to: undefined,
					}
				: {
						range: appliedTimeRange,
						from: undefined,
						to: undefined,
					};
		const nextParams = buildUsageEventUrlSearchParams({
			...normalizedUrlState,
			...nextTimeRangeState,
			...patch,
			aggregate: undefined,
		});
		const nextSearch = nextParams.toString();
		const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;

		window.open(nextUrl, "_blank", "noopener,noreferrer");
	}

	async function handleRefreshTable() {
		setIsRefreshingTable(true);

		try {
			await usageEventTableQuery.refetch();
		} finally {
			setIsRefreshingTable(false);
		}
	}

	async function handleUpdateTable() {
		if (hasPendingTableChange) {
			const nextTimeRangeState =
				draftTimeRange === "all_time"
					? {
							range: undefined,
							from: undefined,
							to: undefined,
						}
					: {
							range: draftTimeRange,
							from: undefined,
							to: undefined,
						};

			updateUrlState({
				q: draftQuery,
				aggregate: draftAggregateField.trim() || undefined,
				...nextTimeRangeState,
			});
		}
	}

	return (
		<TrackablePageFrame
			eyebrow="Current trackable"
			title={gt("Events")}
			description={gt("Review raw API events, then aggregate them by a payload field when needed.")}
			search={
				<TrackableNarrowContent>
					<div className="flex flex-col gap-3 pt-2">
						<p className="text-xs text-muted-foreground">
							
                            							<T>Learn more about liqe syntax</T>{" "}
							<Link
								href="https://www.npmjs.com/package/liqe#query-syntax"
								target="_blank"
								rel="noreferrer"
								className="underline underline-offset-4 transition-colors hover:text-foreground"
							>
								
                                								<T>here</T>
                                							</Link>
							.
						</p>
						<div className="flex flex-row items-center gap-3">
							<div className="min-w-0 flex-1">
								<TrackablePageSearch
									value={draftQuery}
									onChange={setDraftQuery}
									placeholder={gt('Filter events with liqe, for example `event:"signup"`')}
								/>
							</div>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={() => void handleRefreshTable()}
									disabled={isRefreshingTable || usageEventTableQuery.isLoading}
									className="size-12 rounded-2xl"
									aria-label={gt("Refresh data")}
									title={gt("Refresh data")}
								>
									{isRefreshingTable ? (
										<LoaderCircle className="animate-spin" />
									) : (
										<RefreshCw />
									)}
								</Button>
								<Button
									type="button"
									onClick={() => void handleUpdateTable()}
									className="h-12 rounded-2xl px-4"
									disabled={
										usageEventTableQuery.isLoading || !hasPendingTableChange
									}
								>
									
                                    									<T>Update</T>
                                    								</Button>
							</div>
						</div>
						<div className="flex flex-wrap items-start gap-3 pl-4">
							<UsageSelectFilter
								label={gt("Group By")}
								value={draftAggregateField || "__none__"}
								placeholder={gt("None")}
								onValueChange={(value) =>
									setDraftAggregateField(value === "__none__" ? "" : value)
								}
								options={groupByOptions}
							/>
							<UsageTimeRangeFilter
								value={draftTimeRange}
								onValueChange={setDraftTimeRange}
							/>
						</div>
					</div>
				</TrackableNarrowContent>
			}
		>
			{usageEventTableQuery.isError ? (
				<TrackableNarrowContent>
					<Card>
						<CardHeader>
							<CardTitle><T>Unable to build event table</T></CardTitle>
							<CardDescription>
								{usageEventTableQuery.error.message}
							</CardDescription>
						</CardHeader>
					</Card>
				</TrackableNarrowContent>
			) : usageEventTableQuery.data ? (
				<TrackableNarrowContent>
					<UsageEventsTable
						data={usageEventTableQuery.data}
						onFilterToGroup={handleFilterToGroup}
						onApplyFilters={updateUrlState}
					/>
				</TrackableNarrowContent>
			) : (
				<TrackableNarrowContent>
					<UsageEventsTableSkeleton />
				</TrackableNarrowContent>
			)}
		</TrackablePageFrame>
	);
}
