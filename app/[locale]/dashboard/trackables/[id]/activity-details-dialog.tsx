"use client"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { formatAnswerValue, formatSubmissionSource } from "./display-utils"
import { isAnswerableField } from "@/lib/trackable-form-submission"
import type { SubmissionRow } from "./table-types"
import { T, useGT } from "gt-next"

export function ActivityDetailsDialog({
  submission,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  submission: SubmissionRow
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const gt = useGT()
  const fields = submission.submissionSnapshot.form.fields
    .filter(isAnswerableField)
    .map((field) => ({
      field,
      answer: submission.submissionSnapshot.answers.find(
        (answer) => answer.fieldId === field.id
      ),
    }))

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
          <SheetTitle className="text-xl">
            <T>Survey Response</T>
          </SheetTitle>
          <SheetDescription>
            {submission.submitterLabel} <T>submitted via</T>{" "}
            {formatSubmissionSource(submission.source, gt)}.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col overflow-y-auto pt-2 pb-10">
          {fields.map(({ field, answer }, index) => {
            const answerValue = formatAnswerValue(answer?.value, gt)
            const isNoResponse =
              answerValue === gt("No response") ||
              answerValue === gt("No selections")

            return (
              <div
                key={field.id}
                className="group flex flex-col gap-2.5 border-b border-border/40 px-6 py-6 transition-colors last:border-0 hover:bg-muted/10"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-muted/60 text-[11px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    {field.label}
                  </div>
                  {field.description ? (
                    <p className="pl-[32px] text-[13px] leading-relaxed text-muted-foreground/75">
                      {field.description}
                    </p>
                  ) : null}
                </div>
                <div
                  className={`pl-[32px] text-[15px] break-words whitespace-pre-wrap ${
                    isNoResponse
                      ? "text-sm text-muted-foreground/60 italic"
                      : "leading-relaxed font-medium text-foreground"
                  }`}
                >
                  {answerValue}
                </div>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
