"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

import {
	formatAnswerValue,
	formatFieldKind,
	formatMetadataEntries,
	formatSubmissionSource,
} from "./display-utils";
import type { SubmissionRow } from "./table-types";

export function ActivityDetailsDialog({
	submission,
	open,
	onOpenChange,
	hideTrigger = false,
}: {
	submission: SubmissionRow;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	hideTrigger?: boolean;
}) {
	const metadataEntries = formatMetadataEntries(submission.metadata);
	const fields = submission.submissionSnapshot.form.fields.map((field) => ({
		field,
		answer: submission.submissionSnapshot.answers.find(
			(answer) => answer.fieldId === field.id,
		),
	}));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{hideTrigger ? null : (
				<DialogTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 opacity-0 transition-opacity group-hover:opacity-100"
					>
						View Details
					</Button>
				</DialogTrigger>
			)}
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Form Submission Details</DialogTitle>
					<DialogDescription>
						{submission.submitterLabel} submitted via{" "}
						{formatSubmissionSource(submission.source)}.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-6 py-4">
					<div className="overflow-hidden rounded-lg border border-border/60">
						<div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<div>Form structure</div>
							<div>Response</div>
						</div>
						{fields.map(({ field, answer }) => (
							<div
								key={field.id}
								className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 border-b border-border/60 px-4 py-3 last:border-b-0"
							>
								<div className="space-y-1">
									<div className="font-medium">{field.label}</div>
									<div className="text-xs text-muted-foreground">
										{formatFieldKind(field.kind)}
										{field.required ? " • Required" : " • Optional"}
									</div>
									{field.description ? (
										<p className="text-sm text-muted-foreground">
											{field.description}
										</p>
									) : null}
								</div>
								<div className="text-sm text-foreground whitespace-pre-wrap break-words">
									{formatAnswerValue(answer?.value)}
								</div>
							</div>
						))}
					</div>

					{metadataEntries.length > 0 ? (
						<div className="space-y-3">
							<h3 className="text-sm font-medium">Submission metadata</h3>
							<div className="grid gap-3 sm:grid-cols-2">
								{metadataEntries.map((entry) => (
									<div
										key={entry.label}
										className="rounded-lg border border-border/60 px-3 py-2"
									>
										<div className="text-xs uppercase tracking-wide text-muted-foreground">
											{entry.label}
										</div>
										<div className="mt-1 break-all text-sm">{entry.value}</div>
									</div>
								))}
							</div>
						</div>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}
