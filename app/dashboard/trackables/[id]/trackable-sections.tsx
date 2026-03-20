"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	buildUsageEventSearchInput,
	buildUsageEventUrlSearchParams,
	normalizeUsageEventUrlState,
	resolveUsageEventTimeRange,
	type UsageEventTimeRange,
	type UsageEventUrlState,
} from "@/lib/usage-event-search";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, LoaderCircle, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { Control } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiKeysTable } from "./api-keys-table";
import { formatUsageFieldLabel } from "./display-utils";
import { FormBuilder } from "./form-builder";
import { FormSubmissionsTable } from "./form-submissions-table";
import { useTrackableDetails } from "./trackable-shell";
import { UsageEventsTable, UsageEventsTableSkeleton } from "./usage-events-table";

const settingsSchema = z.object({
	name: z.string().min(1, "Trackable name is required"),
	description: z.string().optional(),
	allowAnonymousSubmissions: z.boolean(),
	apiLogRetentionDays: z.enum(["3", "7", "30", "90", "forever"]),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;
type SaveState = "idle" | "saving" | "saved" | "error";

const apiLogRetentionOptions = [
	{ label: "3 days", value: "3" },
	{ label: "1 week", value: "7" },
	{ label: "1 month", value: "30" },
	{ label: "3 months", value: "90" },
	{ label: "Forever", value: "forever" },
] as const;

function toApiLogRetentionSelectValue(
	value: 3 | 7 | 30 | 90 | null | undefined,
): SettingsFormValues["apiLogRetentionDays"] {
	switch (value) {
		case 3:
			return "3";
		case 7:
			return "7";
		case 30:
			return "30";
		case 90:
			return "90";
		default:
			return "forever";
	}
}

function fromApiLogRetentionSelectValue(
	value: SettingsFormValues["apiLogRetentionDays"],
): 3 | 7 | 30 | 90 | null {
	switch (value) {
		case "3":
			return 3;
		case "7":
			return 7;
		case "30":
			return 30;
		case "90":
			return 90;
		default:
			return null;
	}
}

function SettingsToggleField({
	control,
	name,
	label,
	description,
}: {
	control: Control<SettingsFormValues>;
	name: "allowAnonymousSubmissions";
	label: string;
	description: string;
}) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className="flex flex-row items-start justify-between gap-4 rounded-xl border bg-background p-4 shadow-xs">
					<div className="flex flex-col gap-1 pr-2">
						<FormLabel className="text-sm font-medium text-foreground">
							{label}
						</FormLabel>
						<FormDescription className="text-xs leading-5">
							{description}
						</FormDescription>
					</div>
					<FormControl>
						<Switch checked={field.value} onCheckedChange={field.onChange} />
					</FormControl>
				</FormItem>
			)}
		/>
	);
}

function TrackablePageFrame(props: {
	eyebrow: string;
	title: string;
	description: string;
	search?: React.ReactNode;
	children: React.ReactNode;
}) {
	const { search, children } = props;
	const hasTopControls = search !== undefined;

	return (
		<main className="flex-1">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-1 pb-0 lg:px-6">
				{hasTopControls ? (
					<div className="flex flex-col gap-1">{search}</div>
				) : null}
				{children}
			</div>
		</main>
	);
}

function TrackablePageSearch({
	value,
	onChange,
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}) {
	return (
		<div className="relative">
			<Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				className="h-12 rounded-2xl border-border/60 bg-background pr-4 pl-11 shadow-xs"
			/>
		</div>
	);
}

type UsageFilterBoxProps = {
	label: string;
	children: React.ReactNode;
	className?: string;
	roundedUp?: boolean;
};

function UsageFilterBox({
	label,
	children,
	className,
	roundedUp,
}: UsageFilterBoxProps) {
	return (
		<div className="flex items-start gap-3">
			{roundedUp && (
				<div
					className={`h-6 w-8 border-b ${roundedUp ? "rounded-bl-3xl border-l" : ""} border-border`}
				/>
			)}
			<div
				className={cn(
					"flex items-center gap-3 rounded-md bg-accent pl-4 shadow-xs",
					className,
				)}
			>
				<div className="text-xs font-semibold tracking-tight uppercase">
					{label}
				</div>
				{children}
			</div>
		</div>
	);
}

type UsageSelectFilterProps = {
	label: string;
	value: string;
	placeholder: string;
	onValueChange: (value: string) => void;
	options: Array<{ label: string; value: string }>;
};

function UsageSelectFilter({
	label,
	value,
	placeholder,
	onValueChange,
	options,
}: UsageSelectFilterProps) {
	return (
		<UsageFilterBox roundedUp label={label}>
			<Select value={value} onValueChange={onValueChange}>
				<SelectTrigger className="border-none">
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent align="end">
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</UsageFilterBox>
	);
}

const usageTimeRangeOptions: Array<{
	label: string;
	value: Exclude<UsageEventTimeRange, "custom">;
}> = [
	{ label: "Last 15 min", value: "last_15_minutes" },
	{ label: "Last 1 hour", value: "last_1_hour" },
	{ label: "Last 24 hours", value: "last_24_hours" },
	{ label: "Last 7 days", value: "last_7_days" },
	{ label: "All time", value: "all_time" },
];

function UsageTimeRangeFilter({
	value,
	onValueChange,
}: {
	value: Exclude<UsageEventTimeRange, "custom">;
	onValueChange: (value: Exclude<UsageEventTimeRange, "custom">) => void;
}) {
	return (
		<UsageFilterBox label="Time Range">
			<Select
				value={value}
				onValueChange={(nextValue) =>
					onValueChange(nextValue as Exclude<UsageEventTimeRange, "custom">)
				}
			>
				<SelectTrigger className="border-none">
					<SelectValue placeholder="All time" />
				</SelectTrigger>
				<SelectContent align="end">
					{usageTimeRangeOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</UsageFilterBox>
	);
}

function UnsupportedPageState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-col gap-2">
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
		</Card>
	);
}

function TrackableNarrowContent({ children }: { children: React.ReactNode }) {
	return <div className="mx-auto w-full max-w-4xl">{children}</div>;
}

function TrackableSectionHeader({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="mb-4">
			<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			<Separator className="mt-4" />
		</div>
	);
}

function TrackableSettingsPanel({ searchQuery }: { searchQuery: string }) {
	const [, setSaveState] = useState<SaveState>("idle");
	const trackable = useTrackableDetails();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const trackableQueryKey = trpc.trackables.getById.queryKey({
		id: trackable.id,
	});
	const defaultValues = useMemo<SettingsFormValues>(
		() => ({
			name: trackable.name,
			description: trackable.description ?? "",
			allowAnonymousSubmissions:
				trackable.settings?.allowAnonymousSubmissions ?? true,
			apiLogRetentionDays: toApiLogRetentionSelectValue(
				trackable.settings?.apiLogRetentionDays,
			),
		}),
		[trackable.description, trackable.name, trackable.settings],
	);
	const defaultSnapshot = useMemo(
		() => JSON.stringify(defaultValues),
		[defaultValues],
	);
	const isSurvey = trackable.kind === "survey";
	const isApiIngestion = trackable.kind === "api_ingestion";
	const normalizedQuery = searchQuery.trim().toLowerCase();
	const matchesGeneralSection =
		normalizedQuery.length === 0 ||
		[
			"trackable settings",
			"name",
			"description",
			"access defaults",
			"anonymous responses",
			"api settings",
			"log retention",
			"3 days",
			"1 week",
			"1 month",
			"3 months",
			"forever",
			trackable.name,
			trackable.description ?? "",
		]
			.join(" ")
			.toLowerCase()
			.includes(normalizedQuery);
	function serializeSettings(values: SettingsFormValues) {
		return JSON.stringify(values);
	}

	const form = useForm<SettingsFormValues>({
		resolver: zodResolver(settingsSchema),
		defaultValues,
	});

	const updateSettings = useMutation(
		trpc.trackables.updateSettings.mutationOptions(),
	);

	async function onSubmit(values: SettingsFormValues) {
		const snapshot = serializeSettings(values);

		if (snapshot === defaultSnapshot) {
			return;
		}

		setSaveState("saving");

		updateSettings.mutate(
			{
				trackableId: trackable.id,
				name: values.name,
				description: values.description ?? "",
				allowAnonymousSubmissions: values.allowAnonymousSubmissions,
				apiLogRetentionDays: fromApiLogRetentionSelectValue(
					values.apiLogRetentionDays,
				),
			},
			{
				onSuccess: async (_data, variables) => {
					const savedValues: SettingsFormValues = {
						name: variables.name,
						description: variables.description ?? "",
						allowAnonymousSubmissions:
							variables.allowAnonymousSubmissions ?? true,
						apiLogRetentionDays: toApiLogRetentionSelectValue(
							variables.apiLogRetentionDays,
						),
					};

					form.reset(savedValues);
					setSaveState("saved");

					await queryClient.invalidateQueries({
						queryKey: trackableQueryKey,
					});
				},
				onError: () => {
					setSaveState("error");
				},
			},
		);
	}

	const hasUnsavedChanges = form.formState.isDirty;
	const isSaving = form.formState.isSubmitting || updateSettings.isPending;

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			{matchesGeneralSection ? (
				<section className="flex flex-col gap-6">
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="flex flex-col gap-6"
						>
							<div className="grid gap-4">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Trackable name</FormLabel>
											<FormControl>
												<Input placeholder="My trackable" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="What is this trackable for?"
													className="min-h-28 resize-none"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{isSurvey ? (
								<div className="flex flex-col gap-5">
									<div className="flex flex-col gap-1">
										<h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
											<Globe className="size-4 text-muted-foreground" />
											Survey access
										</h3>
										<p className="text-sm text-muted-foreground">
											Control who can open and submit the shared survey.
										</p>
									</div>

									<SettingsToggleField
										control={form.control}
										name="allowAnonymousSubmissions"
										label="Allow anonymous responses"
										description="When off, people must sign in before they can open and submit the shared survey."
									/>
								</div>
							) : null}

							{isApiIngestion ? (
								<div className="flex flex-col gap-5">
									<FormField
										control={form.control}
										name="apiLogRetentionDays"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Log retention</FormLabel>
												<Select
													value={field.value}
													onValueChange={field.onChange}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select retention" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{apiLogRetentionOptions.map((option) => (
															<SelectItem
																key={option.value}
																value={option.value}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormDescription>
													Choose how long API usage logs should be retained.
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							) : null}

							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										form.reset(defaultValues);
										setSaveState("idle");
									}}
									disabled={!hasUnsavedChanges || isSaving}
								>
									Discard
								</Button>
								<Button type="submit" disabled={!hasUnsavedChanges || isSaving}>
									{isSaving ? "Saving..." : "Save changes"}
								</Button>
							</div>
						</form>
					</Form>
				</section>
			) : null}

			{!matchesGeneralSection ? (
				<div className="rounded-2xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
					No settings matched that search.
				</div>
			) : null}
		</div>
	);
}

export function TrackableOverviewSection() {
	const trackable = useTrackableDetails();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [draftQuery, setDraftQuery] = useState("");
	const [appliedQuery, setAppliedQuery] = useState("");
	const [isRefreshingTable, setIsRefreshingTable] = useState(false);
	const hasPendingTableChange = draftQuery.trim() !== appliedQuery.trim();
	const filteredSubmissions = useMemo(() => {
		const normalizedQuery = appliedQuery.trim().toLowerCase();

		if (normalizedQuery.length === 0) {
			return trackable.recentSubmissions;
		}

		return trackable.recentSubmissions.filter((submission) =>
			JSON.stringify(submission.submissionSnapshot)
				.toLowerCase()
				.includes(normalizedQuery),
		);
	}, [appliedQuery, trackable.recentSubmissions]);

	if (trackable.kind === "survey") {
		const trackableQueryKey = trpc.trackables.getById.queryKey({
			id: trackable.id,
		});

		async function handleRefreshTable() {
			setIsRefreshingTable(true);

			try {
				await queryClient.invalidateQueries({
					queryKey: trackableQueryKey,
				});
			} finally {
				setIsRefreshingTable(false);
			}
		}

		function handleUpdateTable() {
			setAppliedQuery(draftQuery);
		}

		return (
			<TrackablePageFrame
				eyebrow="Current trackable"
				title="Responses"
				description="Review the latest structured responses submitted through this survey."
				search={
					<TrackableNarrowContent>
						<div className="flex flex-col gap-3 pt-2">
							<div className="flex flex-row items-center gap-3">
								<div className="min-w-0 flex-1">
									<TrackablePageSearch
										value={draftQuery}
										onChange={setDraftQuery}
										placeholder="Search response text"
									/>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() => void handleRefreshTable()}
										disabled={isRefreshingTable}
										className="size-12 rounded-2xl"
										aria-label="Refresh data"
										title="Refresh data"
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
										disabled={!hasPendingTableChange}
									>
										Update
									</Button>
								</div>
							</div>
						</div>
					</TrackableNarrowContent>
				}
			>
				<TrackableNarrowContent>
					<FormSubmissionsTable data={filteredSubmissions} />
				</TrackableNarrowContent>
			</TrackablePageFrame>
		);
	}

	return <UsageEventsPage />;
}

export function TrackableFormSection() {
	const trackable = useTrackableDetails();

	return (
		<TrackablePageFrame
			eyebrow="Current trackable"
			title="Form"
			description="Build and update the public survey form shown to respondents."
		>
			{trackable.kind !== "survey" ? (
				<UnsupportedPageState
					title="Form builder unavailable"
					description="Only survey trackables have a form builder."
				/>
			) : (
				<TrackableNarrowContent>
					<TrackableSectionHeader
						title="Form"
						description="Build and update the public form people use to submit responses."
					/>
					<FormBuilder
						key={trackable.activeForm?.id ?? "empty-form"}
						trackableId={trackable.id}
						trackableName={trackable.name}
						trackableDescription={trackable.description}
						activeForm={trackable.activeForm}
					/>
				</TrackableNarrowContent>
			)}
		</TrackablePageFrame>
	);
}

export function TrackableSettingsSection() {
	const trackable = useTrackableDetails();
	const searchQuery = "";
	const settingsDescription =
		trackable.kind === "survey"
			? "Manage how this survey is named, described, and shared."
			: "Manage how this API trackable is named and configured.";

	return (
		<TrackablePageFrame
			eyebrow="Current trackable"
			title="Settings"
			description="Update how this trackable is labeled, configured, and shared."
		>
			<TrackableNarrowContent>
				<TrackableSectionHeader
					title="Settings"
					description={settingsDescription}
				/>
				<TrackableSettingsPanel
					searchQuery={searchQuery}
					key={`${trackable.name}:${trackable.description ?? ""}:${
						trackable.settings?.allowAnonymousSubmissions ?? true
					}`}
				/>
			</TrackableNarrowContent>
		</TrackablePageFrame>
	);
}

export function TrackableApiKeysSection() {
	const trackable = useTrackableDetails();
	const searchQuery = "";
	const filteredApiKeys = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		if (normalizedQuery.length === 0) {
			return trackable.apiKeys;
		}

		return trackable.apiKeys.filter((apiKey) =>
			[
				apiKey.name,
				apiKey.maskedKey,
				apiKey.status,
				apiKey.expiresAt ?? "",
				apiKey.lastUsedAt ?? "",
			]
				.join(" ")
				.toLowerCase()
				.includes(normalizedQuery),
		);
	}, [searchQuery, trackable.apiKeys]);

	return (
		<TrackablePageFrame
			eyebrow="Current trackable"
			title="Connection"
			description="Create, review, and revoke the connection keys that authorize log delivery for this trackable."
		>
			{trackable.kind !== "api_ingestion" ? (
				<UnsupportedPageState
					title="Connection unavailable"
					description="Only log trackables can manage connections."
				/>
			) : (
				<TrackableNarrowContent>
					<TrackableSectionHeader
						title="Connection"
						description="Create and manage connection details used to send log events to this trackable."
					/>
					<ApiKeysTable
						data={filteredApiKeys}
						trackableId={trackable.id}
						trackableName={trackable.name}
					/>
				</TrackableNarrowContent>
			)}
		</TrackablePageFrame>
	);
}

function UsageEventsPage() {
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
			title="Events"
			description="Review raw API events, then aggregate them by a payload field when needed."
			search={
				<TrackableNarrowContent>
					<div className="flex flex-col gap-3 pt-2">
						<p className="text-xs text-muted-foreground">
							Learn more about liqe syntax{" "}
							<Link
								href="https://www.npmjs.com/package/liqe#query-syntax"
								target="_blank"
								rel="noreferrer"
								className="underline underline-offset-4 transition-colors hover:text-foreground"
							>
								here
							</Link>
							.
						</p>
						<div className="flex flex-row items-center gap-3">
							<div className="min-w-0 flex-1">
								<TrackablePageSearch
									value={draftQuery}
									onChange={setDraftQuery}
									placeholder='Filter events with liqe, for example `event:"signup"`'
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
									aria-label="Refresh data"
									title="Refresh data"
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
									Update
								</Button>
							</div>
						</div>
						<div className="flex flex-wrap items-start gap-3 pl-4">
							<UsageSelectFilter
								label="Group By"
								value={draftAggregateField || "__none__"}
								placeholder="None"
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
							<CardTitle>Unable to build event table</CardTitle>
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
