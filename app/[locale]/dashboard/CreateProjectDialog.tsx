"use client";

import { WorkspaceTierDialog } from "@/app/[locale]/dashboard/workspace-tier-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	getTrackableKindCreationLabel,
	getTrackableKindVisuals,
} from "@/lib/trackable-kind";
import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement";
import { cn } from "@/lib/utils";
import { getTierLimits } from "@/lib/workspace-tier-config";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next";
import { DatabaseZap, FileText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useWizard, Wizard } from "react-use-wizard";
import { z } from "zod";

const createTrackableSchema = z.object({
	kind: z.enum(["survey", "api_ingestion"]),
	name: z.string().min(2, {
		message: "Trackable name must be at least 2 characters.",
	}),
	description: z.string().optional(),
});

type CreateTrackableValues = z.infer<typeof createTrackableSchema>;

const trackableKindOptions = [
	{
		value: "api_ingestion" as const,
		title: getTrackableKindCreationLabel("api_ingestion"),
		description: "Record log events and manage connection keys.",
		icon: DatabaseZap,
	},
	{
		value: "survey" as const,
		title: getTrackableKindCreationLabel("survey"),
		description: "Collect structured responses with a shareable form.",
		icon: FileText,
	},
];

function CreateTrackableWizardHeader({
	selectedKindTitle,
}: {
	selectedKindTitle: string;
}) {
	const { activeStep } = useWizard();

	return (
		<DialogHeader>
			<DialogTitle>
				{activeStep === 0 ? "Create new trackable" : "Name your trackable"}
			</DialogTitle>
			<DialogDescription>
				{activeStep === 0
					? "Choose the type of trackable you want to create."
					: `Set the name and description for your ${selectedKindTitle.toLowerCase()} trackable.`}
			</DialogDescription>
		</DialogHeader>
	);
}

function CreateTrackableWizardFooter({
	isSubmitting,
	onCancel,
}: {
	isSubmitting: boolean;
	onCancel: () => void;
}) {
	const { activeStep, nextStep, previousStep } = useWizard();

	return (
		<DialogFooter className="pt-2">
			{activeStep === 0 ? (
				<>
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}
						disabled={isSubmitting}
					>
						<T>Cancel</T>
					</Button>
					<Button
						type="button"
						onClick={() => void nextStep()}
						disabled={isSubmitting}
					>
						<T>Continue</T>
					</Button>
				</>
			) : (
				<>
					<Button
						type="button"
						variant="outline"
						onClick={previousStep}
						disabled={isSubmitting}
					>
						<T>Back</T>
					</Button>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? "Creating..." : "Create Trackable"}
					</Button>
				</>
			)}
		</DialogFooter>
	);
}

function TrackableKindStep({
	selectedKind,
	onSelect,
}: {
	selectedKind: CreateTrackableValues["kind"];
	onSelect: (kind: CreateTrackableValues["kind"]) => void;
}) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{trackableKindOptions.map((option) => {
				const Icon = option.icon;
				const isActive = selectedKind === option.value;

				return (
					<button
						key={option.value}
						type="button"
						className={cn(
							"rounded-2xl border p-5 text-left transition-colors",
							isActive
								? getTrackableKindVisuals(option.value).selectedSurfaceClassName
								: "border-border/60 hover:border-foreground/40 hover:bg-muted/30",
						)}
						onClick={() => onSelect(option.value)}
					>
						<div
							className={cn(
								"mb-4 flex size-10 items-center justify-center rounded-full",
								getTrackableKindVisuals(option.value).iconContainerClassName,
							)}
						>
							<Icon className="size-5" />
						</div>
						<div className="space-y-2">
							<div className="font-medium">{option.title}</div>
							<p className="text-sm text-muted-foreground">
								{option.description}
							</p>
						</div>
					</button>
				);
			})}
		</div>
	);
}

function TrackableDetailsStep({
	form,
	selectedKind,
}: {
	form: ReturnType<typeof useForm<CreateTrackableValues>>;
	selectedKind: CreateTrackableValues["kind"];
}) {
	const gt = useGT();
	return (
		<div className="space-y-4">
			<FormField
				control={form.control}
				name="name"
				render={({ field }) => (
					<FormItem>
						<FormLabel>
							<T>Name</T>
						</FormLabel>
						<FormControl>
							<Input
								placeholder={
									selectedKind === "api_ingestion"
										? "e.g. Application logs"
										: "e.g. Customer satisfaction survey"
								}
								{...field}
							/>
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
						<FormLabel>
							<T>Description</T>
						</FormLabel>
						<FormControl>
							<Textarea
								placeholder={gt(
									"Add context for collaborators and future you.",
								)}
								className="min-h-28 resize-none"
								{...field}
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	);
}

export function CreateTrackableDialog() {
	const [open, setOpen] = useState(false);
	const [tierDialogOpen, setTierDialogOpen] = useState(false);
	const [wizardKey, setWizardKey] = useState(0);
	const trpc = useTRPC();
	const router = useRouter();
	const queryClient = useQueryClient();
	const subscriptionsEnabled = isSubscriptionEnforcementEnabled();
	const workspaceContext = useQuery(
		trpc.account.getWorkspaceContext.queryOptions(),
	);
	const metrics = useQuery(trpc.dashboard.getMetrics.queryOptions());
	const currentTier = workspaceContext.data?.activeWorkspace.tier ?? "free";
	const maxTrackableItems = getTierLimits(currentTier).maxTrackableItems;
	const activeTrackablesCount = metrics.data?.activeTrackablesCount ?? 0;
	const isCheckingTrackableLimit =
		subscriptionsEnabled && (workspaceContext.isLoading || metrics.isLoading);
	const hasReachedTrackableLimit =
		subscriptionsEnabled &&
		maxTrackableItems !== null &&
		activeTrackablesCount >= maxTrackableItems;

	const form = useForm<CreateTrackableValues>({
		resolver: zodResolver(createTrackableSchema),
		defaultValues: {
			kind: "survey",
			name: "",
			description: "",
		},
	});

	const selectedKind = useWatch({
		control: form.control,
		name: "kind",
	});
	const selectedKindMeta = useMemo(
		() =>
			trackableKindOptions.find((option) => option.value === selectedKind) ??
			trackableKindOptions[1],
		[selectedKind],
	);

	const createTrackable = useMutation(
		trpc.trackables.create.mutationOptions({
			onSuccess: async (createdTrackable) => {
				form.reset();
				setOpen(false);
				setWizardKey((current) => current + 1);

				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.dashboard.getMetrics.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.dashboard.getTrackables.queryKey(),
					}),
				]);

				router.push(`/dashboard/trackables/${createdTrackable.id}`);
			},
			onError: (error) => {
				if (!error.message.includes("trackable items")) {
					return;
				}

				setOpen(false);
				setTierDialogOpen(true);
			},
		}),
	);

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);

		if (!nextOpen) {
			form.reset();
			setWizardKey((current) => current + 1);
		}
	}

	function handleTriggerClick() {
		if (isCheckingTrackableLimit) {
			return;
		}

		if (hasReachedTrackableLimit) {
			setTierDialogOpen(true);
			return;
		}

		setOpen(true);
	}

	function onSubmit(values: CreateTrackableValues) {
		createTrackable.mutate(values);
	}

	const isSubmitting = form.formState.isSubmitting || createTrackable.isPending;

	return (
		<>
			<Button onClick={handleTriggerClick} disabled={isCheckingTrackableLimit}>
				<Plus className="size-4" />
				<T>New Trackable</T>
			</Button>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="sm:max-w-2xl">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<Wizard
								key={wizardKey}
								header={
									<CreateTrackableWizardHeader
										selectedKindTitle={selectedKindMeta.title}
									/>
								}
								footer={
									<CreateTrackableWizardFooter
										isSubmitting={isSubmitting}
										onCancel={() => setOpen(false)}
									/>
								}
							>
								<TrackableKindStep
									selectedKind={selectedKind}
									onSelect={(kind) => form.setValue("kind", kind)}
								/>
								<TrackableDetailsStep
									form={form}
									selectedKind={selectedKind}
								/>
							</Wizard>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
			{subscriptionsEnabled ? (
				<WorkspaceTierDialog
					currentTier={currentTier}
					open={tierDialogOpen}
					onOpenChange={setTierDialogOpen}
				/>
			) : null}
		</>
	);
}
