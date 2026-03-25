"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { toast } from "sonner";
import { T, useGT } from "gt-next";

import { cn } from "@/lib/utils";

import { DateRangeField } from "./DateRangeField";
import { DateRangePopover } from "./DateRangePopover";
import { DateRangePresets } from "./DateRangePresets";
import { useDateRangeInput } from "./hooks/use-date-range-input";
import { getNextDateRangeSelection } from "./utils/date-range-selection";
import { formatDurationBadge, getDateRangeDurationMs } from "./utils/duration";
import { defaultDateRangePresets } from "./utils/presets";
import type {
	DateRangeChangeMeta,
	DateRangePreset,
	DateRangeValue,
} from "./utils/types";

export type DateRangeInputProps = {
	allowFuture?: boolean;
	className?: string;
	defaultValue?: DateRangeValue | null;
	disabled?: boolean;
	errorClassName?: string;
	fieldClassName?: string;
	id?: string;
	inputClassName?: string;
	nowProvider?: () => Date;
	onChange?: (value: DateRangeValue | null, meta: DateRangeChangeMeta) => void;
	onCommit?: (value: DateRangeValue | null, meta: DateRangeChangeMeta) => void;
	placeholder?: string;
	popoverClassName?: string;
	presetListClassName?: string;
	presets?: DateRangePreset[];
	value?: DateRangeValue | null;
	durationClassName?: string;
	"aria-label"?: string;
	name?: string;
};

export function DateRangeInput({
	allowFuture,
	className,
	defaultValue,
	disabled = false,
	durationClassName,
	errorClassName,
	fieldClassName,
	id,
	inputClassName,
	nowProvider,
	onChange,
	onCommit,
	placeholder,
	popoverClassName,
	presetListClassName,
	presets = defaultDateRangePresets,
	value,
	...props
}: DateRangeInputProps) {
	const gt = useGT();
	const inputId = useId();
	const errorId = useId();
	const popoverId = useId();
	const rootRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const {
		committedValue,
		commitDraft,
		displayValue,
		draftText,
		error,
		isOpen,
		presets: resolvedPresets,
		resetDraftToCommitted,
		selectPreset,
		setDraftText,
		setIsFocused,
		setIsOpen,
	} = useDateRangeInput({
		allowFuture,
		defaultValue,
		nowProvider,
		onChange,
		onCommit,
		presets,
		value,
	});

	useEffect(() => {
		if (!error) {
			return;
		}

		toast.error(error);
	}, [error]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		function handleOutsideInteraction(event: MouseEvent | FocusEvent) {
			const target = event.target;

			if (!(target instanceof Node)) {
				return;
			}

			if (rootRef.current?.contains(target)) {
				return;
			}

			commitDraft("blur");
			setIsFocused(false);
			setIsOpen(false);
		}

		document.addEventListener("mousedown", handleOutsideInteraction);
		document.addEventListener("focusin", handleOutsideInteraction);

		return () => {
			document.removeEventListener("mousedown", handleOutsideInteraction);
			document.removeEventListener("focusin", handleOutsideInteraction);
		};
	}, [commitDraft, isOpen, setIsOpen, setIsFocused]);

	const durationLabel = useMemo(() => {
		if (!committedValue || committedValue.presetKey === "all_time") {
			return null;
		}

		return formatDurationBadge(getDateRangeDurationMs(committedValue));
	}, [committedValue]);

	return (
		<div ref={rootRef} className={cn("flex flex-col gap-1.5", className)}>
			<div className="relative">
				<DateRangeField
					{...props}
					id={id ?? inputId}
					disabled={disabled}
					aria-controls={popoverId}
					aria-describedby={error ? errorId : undefined}
					aria-expanded={isOpen}
					aria-haspopup="listbox"
					aria-invalid={Boolean(error)}
					autoComplete="off"
					durationLabel={
						durationLabel ? (
							<span className={cn(durationClassName)}>{durationLabel}</span>
						) : undefined
					}
					error={error}
					fieldClassName={fieldClassName}
					inputClassName={inputClassName}
					inputRef={inputRef}
					onChange={(event) => {
						setDraftText(event.currentTarget.value);
						setIsOpen(true);
					}}
					onFocus={() => {
						setIsFocused(true);
						setIsOpen(true);
						if (error) {
							return;
						}
						if (!draftText && committedValue) {
							resetDraftToCommitted();
						}
					}}
					onBlur={() => {
						setIsFocused(false);
					}}
					onKeyDown={(event) => {
						if (
							(event.key === "ArrowLeft" || event.key === "ArrowRight") &&
							!event.altKey &&
							!event.ctrlKey &&
							!event.metaKey &&
							!event.shiftKey
						) {
							const nextSelection = getNextDateRangeSelection(
								event.currentTarget.value,
								event.currentTarget.selectionStart ?? 0,
								event.currentTarget.selectionEnd ?? 0,
								event.key === "ArrowLeft" ? "left" : "right",
							);

							if (nextSelection) {
								event.preventDefault();
								event.currentTarget.setSelectionRange(
									nextSelection.start,
									nextSelection.end,
								);
								return;
							}
						}

						if (event.key === "Enter") {
							event.preventDefault();
							commitDraft("enter");
						}

						if (event.key === "Escape") {
							event.preventDefault();
							resetDraftToCommitted();
							setIsOpen(false);
							inputRef.current?.blur();
						}

						if (event.key === "ArrowDown" && !isOpen) {
							event.preventDefault();
							setIsOpen(true);
						}
					}}
					placeholder={placeholder ?? gt("Past 15 minutes")}
					value={displayValue}
				/>

				<DateRangePopover
					id={popoverId}
					open={isOpen && !disabled}
					className={popoverClassName}
				>
					<div className="flex flex-col gap-2">
						<div className="px-1 text-[11px] leading-4 text-muted-foreground">
							Type a range like{" "}
							<span className="font-medium text-foreground">
								past 15 minutes
							</span>{" "}
							or <span className="font-medium text-foreground"><T>past hour</T></span>.
						</div>
						<DateRangePresets
							className={presetListClassName}
							presets={resolvedPresets}
							selectedPresetKey={committedValue?.presetKey}
							onClose={() => {
								setIsOpen(false);
								inputRef.current?.focus();
							}}
							onSelect={(preset) => {
								selectPreset(preset);
								inputRef.current?.focus();
							}}
						/>
					</div>
				</DateRangePopover>
			</div>
			{error ? (
				<p id={errorId} role="alert" className={cn("sr-only", errorClassName)}>
					{error}
				</p>
			) : null}
		</div>
	);
}
