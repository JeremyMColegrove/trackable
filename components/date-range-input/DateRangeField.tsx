"use client";

import type { InputHTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "@/lib/utils";

type DateRangeFieldProps = {
	durationLabel?: ReactNode;
	error?: string | null;
	fieldClassName?: string;
	inputClassName?: string;
	inputRef?: Ref<HTMLInputElement>;
} & InputHTMLAttributes<HTMLInputElement>;

export function DateRangeField({
	className,
	durationLabel,
	error,
	fieldClassName,
	inputClassName,
	inputRef,
	...props
}: DateRangeFieldProps) {
	return (
		<div
			data-invalid={Boolean(error) || undefined}
			className={cn(
				"group flex min-w-0 items-center rounded-lg border border-input bg-background shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-[invalid=true]:border-destructive data-[invalid=true]:ring-3 data-[invalid=true]:ring-destructive/15 dark:bg-input/30",
				fieldClassName,
				className,
			)}
		>
			{durationLabel ? (
				<span className="shrink-0 pl-2.5 text-[11px] font-medium text-muted-foreground">
					{durationLabel}
				</span>
			) : null}
			<input
				ref={inputRef}
				data-slot="date-range-input"
				className={cn(
					"h-8 min-w-0 flex-1 bg-transparent pr-2 pl-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
					durationLabel ? "pl-2" : "",
					inputClassName,
				)}
				{...props}
			/>
		</div>
	);
}
