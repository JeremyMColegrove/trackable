"use client";

import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useMemo, useState } from "react";
import type { Control } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTrackableDetails } from "./trackable-shell";
import {
	TrackablePageFrame,
	TrackableNarrowContent,
	TrackableSectionHeader,
} from "./components/trackable-page-frame";
import { T, useGT } from "gt-next";

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

function TrackableSettingsPanel({ searchQuery }: { searchQuery: string }) {
    const gt = useGT();
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
											<FormLabel><T>Trackable name</T></FormLabel>
											<FormControl>
												<Input placeholder={gt("My trackable")} {...field} />
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
											<FormLabel><T>Description</T></FormLabel>
											<FormControl>
												<Textarea
													placeholder={gt("What is this trackable for?")}
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
											
                                            											<T>Survey access</T>
                                            										</h3>
										<p className="text-sm text-muted-foreground">
											
                                            											<T>Control who can open and submit the shared survey.</T>
                                            										</p>
									</div>

									<SettingsToggleField
										control={form.control}
										name="allowAnonymousSubmissions"
										label={gt("Allow anonymous responses")}
										description={gt("When off, people must sign in before they can open and submit the shared survey.")}
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
												<FormLabel><T>Log retention</T></FormLabel>
												<Select
													value={field.value}
													onValueChange={field.onChange}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder={gt("Select retention")} />
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
													
                                                    													<T>Choose how long API usage logs should be retained.</T>
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
									
                                    									<T>Discard</T>
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
					
                    					<T>No settings matched that search.</T>
                    				</div>
			) : null}
		</div>
	);
}

export function TrackableSettingsSection() {
    const gt = useGT();
	const trackable = useTrackableDetails();
	const searchQuery = "";
	const settingsDescription =
		trackable.kind === "survey"
			? "Manage how this survey is named, described, and shared."
			: "Manage how this API trackable is named and configured.";

	return (
		<TrackablePageFrame
			eyebrow="Current trackable"
			title={gt("Settings")}
			description={gt("Update how this trackable is labeled, configured, and shared.")}
		>
			<TrackableNarrowContent>
				<TrackableSectionHeader
					title={gt("Settings")}
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
