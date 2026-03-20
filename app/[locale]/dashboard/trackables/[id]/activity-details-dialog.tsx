"use client";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";

import {
	formatAnswerValue,
	formatSubmissionSource,
} from "./display-utils";
import type { SubmissionRow } from "./table-types";
import { T } from "gt-next";

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
	const fields = submission.submissionSnapshot.form.fields.map((field) => ({
		field,
		answer: submission.submissionSnapshot.answers.find(
			(answer) => answer.fieldId === field.id,
		),
	}));

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			{hideTrigger ? null : (
				<SheetTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 opacity-0 transition-opacity group-hover:opacity-100"
					>
						
                        						<T>View Details</T>
                        					</Button>
				</SheetTrigger>
			)}
			<SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
				<SheetHeader className="gap-3 border-b px-6 py-5">
					<SheetTitle className="text-xl"><T>Survey Response</T></SheetTitle>
					<SheetDescription>
						{submission.submitterLabel}  <T>submitted via</T>{" "}
						{formatSubmissionSource(submission.source)}.
					</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col gap-3 overflow-y-auto px-6 py-5">
					{fields.map(({ field, answer }) => (
						<div
							key={field.id}
							className="rounded-xl border border-border/60 bg-background p-4"
						>
							<div className="space-y-1">
								<div className="font-medium">{field.label}</div>
								{field.description ? (
									<p className="text-sm text-muted-foreground">
										{field.description}
									</p>
								) : null}
							</div>
							<div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap break-words text-foreground">
								{formatAnswerValue(answer?.value)}
							</div>
						</div>
					))}
				</div>
			</SheetContent>
		</Sheet>
	);
}
