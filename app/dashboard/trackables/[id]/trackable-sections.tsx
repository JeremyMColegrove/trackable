"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Globe, Link2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Control } from "react-hook-form";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiKeysTable } from "./api-keys-table";
import { formatDateTime } from "./display-utils";
import { FormBuilder } from "./form-builder";
import { FormSubmissionsTable } from "./form-submissions-table";
import type { ShareLinkRow } from "./table-types";
import { useTrackableDetails } from "./trackable-shell";
import { UsageEventsTable } from "./usage-events-table";

const settingsSchema = z.object({
	name: z.string().min(1, "Trackable name is required"),
	description: z.string().optional(),
	allowAnonymousSubmissions: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;
type SaveState = "idle" | "saving" | "saved" | "error";

function buildSurveyLink(token: string) {
	if (typeof window === "undefined") {
		return `/share/${token}`;
	}

	return `${window.location.origin}/share/${token}`;
}

function getSurveyLink(links: ShareLinkRow[]) {
	return links.find((link) => !link.revokedAt) ?? links[0] ?? null;
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

function TrackablePageFrame({
	eyebrow,
	title,
	description,
	search,
	children,
}: {
	eyebrow: string;
	title: string;
	description: string;
	search?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<main className="flex-1">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-4 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-1">
					{/* <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
						{eyebrow}
					</p> */}
					{/* <div className="flex flex-col gap-2">
						<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
						<p className="max-w-3xl text-sm text-muted-foreground">
							{description}
						</p>
					</div> */}
					{search}
				</div>
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
		<div className="relative pt-2">
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

function SurveyShareSettings() {
	const [copied, setCopied] = useState(false);
	const trackable = useTrackableDetails();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const trackableQueryKey = trpc.trackables.getById.queryKey({
		id: trackable.id,
	});

	const surveyLink = useMemo(
		() => getSurveyLink(trackable.shareSettings.shareLinks),
		[trackable.shareSettings.shareLinks],
	);
	const linkIsOn = Boolean(surveyLink && !surveyLink.revokedAt);
	const hasForm = Boolean(trackable.activeForm);

	async function refreshTrackable() {
		await queryClient.invalidateQueries({
			queryKey: trackableQueryKey,
		});
	}

	const createShareLink = useMutation(
		trpc.trackables.createShareLink.mutationOptions({
			onSuccess: refreshTrackable,
		}),
	);

	const updateShareLink = useMutation(
		trpc.trackables.updateShareLink.mutationOptions({
			onSuccess: refreshTrackable,
		}),
	);

	const isBusy = createShareLink.isPending || updateShareLink.isPending;

	function turnLinkOn() {
		if (surveyLink) {
			updateShareLink.mutate({
				trackableId: trackable.id,
				linkId: surveyLink.id,
				role: "submit",
				isActive: true,
			});
			return;
		}

		createShareLink.mutate({
			trackableId: trackable.id,
			role: "submit",
		});
	}

	function turnLinkOff() {
		if (!surveyLink) {
			return;
		}

		updateShareLink.mutate({
			trackableId: trackable.id,
			linkId: surveyLink.id,
			role: "submit",
			isActive: false,
		});
	}

	async function copyLink() {
		if (!surveyLink || !linkIsOn) {
			return;
		}

		await navigator.clipboard.writeText(buildSurveyLink(surveyLink.token));
		setCopied(true);
		window.setTimeout(() => setCopied(false), 2000);
	}

	return (
		<section className="flex flex-col gap-4 border-t border-border/60 pt-8">
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<Globe className="size-4 text-muted-foreground" />
					<h2 className="text-lg font-semibold tracking-tight">Form sharing</h2>
				</div>
				<p className="text-sm text-muted-foreground">
					Manage the public survey link from the settings page instead of a
					popup.
				</p>
			</div>
			<div className="flex flex-col gap-4">
				{!hasForm ? (
					<div className="rounded-xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
						Create a form first, then you can turn on a share link for it.
					</div>
				) : (
					<>
						<div className="rounded-xl border bg-muted/20 p-4">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-2">
										<span className="font-medium">Survey link</span>
										<Badge variant="outline">{linkIsOn ? "On" : "Off"}</Badge>
									</div>
									<p className="text-sm text-muted-foreground">
										Turn this on when you want people to fill out the survey.
									</p>
								</div>

								<Button
									type="button"
									variant={linkIsOn ? "outline" : "default"}
									onClick={linkIsOn ? turnLinkOff : turnLinkOn}
									disabled={isBusy}
								>
									{linkIsOn
										? "Turn off"
										: createShareLink.isPending
											? "Turning on..."
											: "Turn on"}
								</Button>
							</div>
						</div>

						<div className="rounded-xl border bg-background p-4">
							<div className="flex items-center gap-2 text-sm font-medium">
								<Link2 className="size-4 text-muted-foreground" />
								<span>Public form link</span>
							</div>

							<div className="mt-3 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
								{surveyLink
									? buildSurveyLink(surveyLink.token)
									: "Link not created yet"}
							</div>

							<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div className="text-sm text-muted-foreground">
									{surveyLink
										? `Created ${formatDateTime(surveyLink.createdAt)}`
										: "Turn the link on to create it."}
								</div>

								<Button
									type="button"
									variant="outline"
									onClick={() => void copyLink()}
									disabled={!surveyLink || !linkIsOn || isBusy}
								>
									{copied ? <Check /> : <Copy />}
									{copied ? "Copied" : "Copy link"}
								</Button>
							</div>
						</div>
					</>
				)}
			</div>
		</section>
	);
}

function TrackableSettingsPanel({ searchQuery }: { searchQuery: string }) {
	const [saveState, setSaveState] = useState<SaveState>("idle");
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
		}),
		[trackable.description, trackable.name, trackable.settings],
	);
	const defaultSnapshot = useMemo(
		() => JSON.stringify(defaultValues),
		[defaultValues],
	);
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveStateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const inFlightRef = useRef<string | null>(null);
	const lastSavedRef = useRef(defaultSnapshot);
	const isSurvey = trackable.kind === "survey";
	const normalizedQuery = searchQuery.trim().toLowerCase();
	const matchesGeneralSection =
		normalizedQuery.length === 0 ||
		[
			"trackable settings",
			"name",
			"description",
			"access defaults",
			"anonymous responses",
			trackable.name,
			trackable.description ?? "",
		]
			.join(" ")
			.toLowerCase()
			.includes(normalizedQuery);
	const matchesSharingSection =
		isSurvey &&
		(normalizedQuery.length === 0 ||
			[
				"form sharing",
				"survey link",
				"public form link",
				"share settings",
				"anonymous responses",
			]
				.join(" ")
				.toLowerCase()
				.includes(normalizedQuery));

	function serializeSettings(values: SettingsFormValues) {
		return JSON.stringify(values);
	}

	function clearSaveTimers() {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}

		if (saveStateTimeoutRef.current) {
			clearTimeout(saveStateTimeoutRef.current);
			saveStateTimeoutRef.current = null;
		}
	}

	const form = useForm<SettingsFormValues>({
		resolver: zodResolver(settingsSchema),
		defaultValues,
	});
	const watchedSettings = useWatch({ control: form.control });

	const updateSettings = useMutation(
		trpc.trackables.updateSettings.mutationOptions(),
	);

	const queueSave = useCallback(
		(delay = 500) => {
			function runSave() {
				const parsedValues = settingsSchema.safeParse(form.getValues());

				if (!parsedValues.success) {
					setSaveState("idle");
					return;
				}

				const snapshot = serializeSettings(parsedValues.data);

				if (
					snapshot === lastSavedRef.current ||
					snapshot === inFlightRef.current
				) {
					return;
				}

				if (updateSettings.isPending) {
					setSaveState("saving");
					saveTimeoutRef.current = setTimeout(runSave, 250);
					return;
				}

				inFlightRef.current = snapshot;
				setSaveState("saving");
				updateSettings.mutate(
					{
						trackableId: trackable.id,
						name: parsedValues.data.name,
						description: parsedValues.data.description ?? "",
						allowAnonymousSubmissions:
							parsedValues.data.allowAnonymousSubmissions,
					},
					{
						onSuccess: async (_data, variables) => {
							await queryClient.invalidateQueries({
								queryKey: trackableQueryKey,
							});

							const savedValues: SettingsFormValues = {
								name: variables.name,
								description: variables.description ?? "",
								allowAnonymousSubmissions:
									variables.allowAnonymousSubmissions ?? true,
							};
							const savedSnapshot = serializeSettings(savedValues);
							const currentSnapshot = serializeSettings(form.getValues());

							lastSavedRef.current = savedSnapshot;
							inFlightRef.current = null;

							if (currentSnapshot === savedSnapshot) {
								form.reset(savedValues);
								setSaveState("saved");
								saveStateTimeoutRef.current = setTimeout(() => {
									setSaveState("idle");
								}, 1500);
								return;
							}

							setSaveState("idle");
							saveTimeoutRef.current = setTimeout(runSave, 150);
						},
						onError: () => {
							inFlightRef.current = null;
							setSaveState("error");
						},
					},
				);
			}

			clearSaveTimers();
			saveTimeoutRef.current = setTimeout(runSave, delay);
		},
		[form, queryClient, trackable.id, trackableQueryKey, updateSettings],
	);

	useEffect(() => {
		queueSave();
		return () => {
			clearSaveTimers();
		};
	}, [queueSave, watchedSettings]);

	useEffect(() => {
		return () => {
			clearSaveTimers();
		};
	}, []);

	return (
		<div className="flex flex-col gap-6">
			{matchesGeneralSection ? (
				<section className="flex flex-col gap-6">
					<div className="flex flex-col gap-2">
						<h2 className="text-lg font-semibold tracking-tight">
							Trackable settings
						</h2>
						<p className="text-sm text-muted-foreground">
							Manage naming, behavior, and access defaults for this trackable.
						</p>
					</div>
					<Form {...form}>
						<form className="flex flex-col gap-6">
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
						</form>
					</Form>

					<div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
						{saveState === "saving" && "Saving changes..."}
						{saveState === "saved" && "All changes saved."}
						{saveState === "error" && "Unable to save changes."}
						{saveState === "idle" && "Changes save automatically."}
					</div>
				</section>
			) : null}

			{matchesSharingSection ? <SurveyShareSettings /> : null}
			{!matchesGeneralSection && !matchesSharingSection ? (
				<div className="rounded-2xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
					No settings matched that search.
				</div>
			) : null}
		</div>
	);
}

export function TrackableOverviewSection() {
	const trackable = useTrackableDetails();

	if (trackable.kind === "survey") {
		return (
			<TrackablePageFrame
				eyebrow="Current trackable"
				title="Responses"
				description="Review the latest structured responses submitted through this survey."
			>
				<Card className="min-w-0">
					<CardContent className="min-w-0">
						<FormSubmissionsTable data={trackable.recentSubmissions} />
					</CardContent>
				</Card>
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
				<FormBuilder
					key={trackable.activeForm?.id ?? "empty-form"}
					trackableId={trackable.id}
					trackableName={trackable.name}
					activeForm={trackable.activeForm}
				/>
			)}
		</TrackablePageFrame>
	);
}

export function TrackableSettingsSection() {
	const trackable = useTrackableDetails();
	const [searchQuery, setSearchQuery] = useState("");

	return (
		<TrackablePageFrame
			eyebrow="Current trackable"
			title="Settings"
			description="Update how this trackable is labeled, configured, and shared."
		>
			<TrackableSettingsPanel
				searchQuery={searchQuery}
				key={`${trackable.name}:${trackable.description ?? ""}:${
					trackable.settings?.allowAnonymousSubmissions ?? true
				}`}
			/>
		</TrackablePageFrame>
	);
}

export function TrackableApiKeysSection() {
	const trackable = useTrackableDetails();
	const [searchQuery, setSearchQuery] = useState("");
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
			title="API Keys"
			description="Create, review, and revoke the keys that authorize ingestion for this trackable."
		>
			{trackable.kind !== "api_ingestion" ? (
				<UnsupportedPageState
					title="API keys unavailable"
					description="Only API ingestion trackables can manage API keys."
				/>
			) : (
				<ApiKeysTable data={filteredApiKeys} trackableId={trackable.id} />
			)}
		</TrackablePageFrame>
	);
}

function UsageEventsPage() {
	const trackable = useTrackableDetails();
	const [searchQuery, setSearchQuery] = useState("");
	const filteredUsageEvents = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		if (normalizedQuery.length === 0) {
			return trackable.recentUsageEvents;
		}

		return trackable.recentUsageEvents.filter((usageEvent) =>
			[usageEvent.name, usageEvent.apiKey.name, usageEvent.apiKey.maskedKey]
				.join(" ")
				.toLowerCase()
				.includes(normalizedQuery),
		);
	}, [searchQuery, trackable.recentUsageEvents]);

	return (
		<TrackablePageFrame
			eyebrow="Current trackable"
			title="Events"
			description="Review recent ingestion activity grouped by event name and API key."
			search={
				<TrackablePageSearch
					value={searchQuery}
					onChange={setSearchQuery}
					placeholder="Search events, keys, and names"
				/>
			}
		>
			<UsageEventsTable data={filteredUsageEvents} />
		</TrackablePageFrame>
	);
}
