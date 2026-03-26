"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TrackableFormSnapshot } from "@/db/schema/types";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T } from "gt-next";
import { Check, Copy, Globe, Link2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDateTime } from "./display-utils";
import { hasConfiguredTrackableForm } from "./trackable-form-status";
import type { ShareLinkRow } from "./table-types";

function buildSurveyLink(token: string) {
	if (typeof window === "undefined") {
		return `/share/${token}`;
	}

	return `${window.location.origin}/share/${token}`;
}

function getSurveyLink(links: ShareLinkRow[]) {
	return links.find((link) => !link.revokedAt) ?? links[0] ?? null;
}

type SurveyShareDialogProps = {
	trackableId: string;
	activeForm: Pick<TrackableFormSnapshot, "id" | "fields"> | null;
	shareLinks: ShareLinkRow[];
	trigger?: React.ReactNode;
	hideTrigger?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export function SurveyShareDialog({
	trackableId,
	activeForm,
	shareLinks,
	trigger,
	hideTrigger = false,
	open,
	onOpenChange,
}: SurveyShareDialogProps) {
	const [copied, setCopied] = useState(false);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const trackableQueryKey = trpc.trackables.getById.queryKey({
		id: trackableId,
	});

	const surveyLink = useMemo(() => getSurveyLink(shareLinks), [shareLinks]);
	const linkIsOn = Boolean(surveyLink && !surveyLink.revokedAt);
	const hasForm = hasConfiguredTrackableForm(activeForm);

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
				trackableId,
				linkId: surveyLink.id,
				role: "submit",
				isActive: true,
			});
			return;
		}

		createShareLink.mutate({
			trackableId,
			role: "submit",
		});
	}

	function turnLinkOff() {
		if (!surveyLink) {
			return;
		}

		updateShareLink.mutate({
			trackableId,
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			{!hideTrigger ? (
				<DialogTrigger asChild>
					{trigger ?? (
						<Button
							variant="default"
							type="button"
							size="lg"
							disabled={!hasForm}
							title={
								!hasForm
									? "Add at least one field before sharing the survey."
									: undefined
							}
						>
							<Send className="size-4" />

							<T>Send Survey</T>
						</Button>
					)}
				</DialogTrigger>
			) : null}
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						<T>Send survey</T>
					</DialogTitle>
					<DialogDescription>
						<T>
							Turn the public survey link on when you are ready to share it,
							then copy the link to send it out.
						</T>
					</DialogDescription>
				</DialogHeader>

				{!hasForm ? (
					<div className="rounded-xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
						<T>
							Add your first field in the form builder before turning on sharing.
						</T>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<div className="rounded-xl border bg-muted/20 p-4">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-2">
										<Globe className="size-4 text-muted-foreground" />
										<span className="font-medium">
											<T>Survey link</T>
										</span>
										<Badge variant="outline">{linkIsOn ? "On" : "Off"}</Badge>
									</div>
									<p className="text-sm text-muted-foreground">
										<T>
											Control whether respondents can open the shared survey.
										</T>
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
								<span>
									<T>Public form link</T>
								</span>
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
					</div>
				)}

				<DialogFooter showCloseButton />
			</DialogContent>
		</Dialog>
	);
}
