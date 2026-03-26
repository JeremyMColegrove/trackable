"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useGT, useLocale } from "gt-next";
import { LayoutTemplateIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { ActivityDetailsDialog } from "./activity-details-dialog";
import { buildFormSubmissionExportPayload } from "./form-submission-export";
import { formSubmissionColumns } from "./form-submission-columns";
import { SurveyShareDialog } from "./survey-share-dialog";
import type { ShareLinkRow, SubmissionRow } from "./table-types";
import { hasConfiguredTrackableForm } from "./trackable-form-status";
import { useTrackableDetails } from "./trackable-shell";
import { TrackableTableEmptyState } from "./trackable-table-empty-state";

export function FormSubmissionsTable({
	data,
	headerButton,
	exportFileName,
}: {
	data: SubmissionRow[];
	headerButton?: React.ReactNode;
	exportFileName: string;
}) {
	const gt = useGT();
	const locale = useLocale();
	const trackable = useTrackableDetails();
	const [selectedSubmission, setSelectedSubmission] =
		useState<SubmissionRow | null>(null);
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const dashboardBaseHref =
		locale === "en" ? "/dashboard" : `/${locale}/dashboard`;
	const formBuilderHref = `${dashboardBaseHref}/trackables/${trackable.id}/form`;
	const canManageForm = trackable.permissions.canManageForm;
	const hasReceivedSubmission = trackable.submissionCount > 0;
	const hasForm = hasConfiguredTrackableForm(trackable.activeForm);
	const hasActiveShareLink = hasUsableShareLink(
		trackable.shareSettings.shareLinks,
	);

	const emptyState = hasReceivedSubmission ? (
		gt("No responses found.")
	) : !hasForm ? (
		<TrackableTableEmptyState
			title={gt("Form is not ready yet")}
			description={gt(
				"Build the form first so people have something to submit.",
			)}
			actionIcon={<LayoutTemplateIcon />}
			actionHref={canManageForm ? formBuilderHref : undefined}
			actionLabel={canManageForm ? gt("Open Form Builder") : undefined}
		/>
	) : !hasActiveShareLink ? (
		<TrackableTableEmptyState
			title={gt("No link yet")}
			description={gt(
				"Your form is ready, but it still needs a live share link before responses can arrive.",
			)}
			action={
				canManageForm ? (
					<Button
						type="button"
						size="lg"
						className="mt-1"
						onClick={() => setShareDialogOpen(true)}
					>
						<SendIcon />
						{gt("Send Survey")}
					</Button>
				) : undefined
			}
		/>
	) : (
		<TrackableTableEmptyState
			title={gt("Waiting for the first response")}
			description={gt(
				"The form is live. Submissions will appear here as soon as someone sends one.",
			)}
		/>
	);

	return (
		<>
			<DataTable
				columns={formSubmissionColumns}
				data={data}
				title={gt("Survey Data")}
				description={gt(
					"Latest structured responses submitted to this trackable.",
				)}
				headerButton={headerButton}
				exportOptions={{
					fileName: exportFileName,
					buildPayload: ({ rows, fileName }) =>
						buildFormSubmissionExportPayload({
							fileName,
							submissions: rows.map((row) => row.original),
						}),
				}}
				onRowClick={setSelectedSubmission}
				emptyMessage={emptyState}
				initialPageSize={10}
			/>
			{selectedSubmission ? (
				<ActivityDetailsDialog
					submission={selectedSubmission}
					open
					hideTrigger
					onOpenChange={(open) => {
						if (!open) {
							setSelectedSubmission(null);
						}
					}}
				/>
			) : null}
			{canManageForm ? (
				<SurveyShareDialog
					trackableId={trackable.id}
					activeForm={trackable.activeForm}
					shareLinks={trackable.shareSettings.shareLinks}
					hideTrigger
					open={shareDialogOpen}
					onOpenChange={setShareDialogOpen}
				/>
			) : null}
		</>
	);
}

function hasUsableShareLink(shareLinks: ShareLinkRow[]) {
	const now = Date.now();

	return shareLinks.some((shareLink) => {
		if (shareLink.revokedAt) {
			return false;
		}

		if (!shareLink.expiresAt) {
			return true;
		}

		return new Date(shareLink.expiresAt).getTime() > now;
	});
}
