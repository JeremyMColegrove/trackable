import {
	DateRangeInput,
	type DateRangePreset,
	type DateRangeValue,
} from "@/components/date-range-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usageEventPresetRangeDefinitions } from "@/lib/usage-event-search";
import { cn } from "@/lib/utils";
import { useGT } from "gt-next";

export type UsageFilterBoxProps = {
	label: string;
	children: React.ReactNode;
	className?: string;
	roundedUp?: boolean;
};

export function UsageFilterBox({
	label,
	children,
	className,
}: UsageFilterBoxProps) {
	return (
		<div className="flex items-start gap-3">
			<div
				className={cn(
					"flex items-center gap-3 rounded-md bg-accent pl-4 shadow-xs",
					className,
				)}
			>
				<div className="text-xs font-semibold uppercase tracking-tight">
					{label}
				</div>
				{children}
			</div>
		</div>
	);
}

export type UsageSelectFilterProps = {
	label: string;
	value: string;
	placeholder: string;
	onValueChange: (value: string) => void;
	options: Array<{ label: string; value: string }>;
};

export function UsageSelectFilter({
	label,
	value,
	placeholder,
	onValueChange,
	options,
}: UsageSelectFilterProps) {
	return (
		<UsageFilterBox roundedUp label={label}>
			<Select value={value} onValueChange={onValueChange}>
				<SelectTrigger className="border-none">
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent align="end">
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</UsageFilterBox>
	);
}

export const usageTimeRangePresets: DateRangePreset[] =
	usageEventPresetRangeDefinitions.map((preset) => ({
		key: preset.range,
		label: preset.label,
		getRange(now) {
			if (preset.durationMs === null) {
				return {
					start: new Date(0),
					end: new Date(now),
				};
			}

			return {
				start: new Date(now.getTime() - preset.durationMs),
				end: new Date(now),
			};
		},
	}));

export function UsageTimeRangeFilter({
	value,
	onValueChange,
}: {
	value: DateRangeValue | null;
	onValueChange: (value: DateRangeValue | null) => void;
}) {
	const gt = useGT();

	return (
		<DateRangeInput
			aria-label={gt("Log time range")}
			value={value}
			onChange={onValueChange}
			placeholder={gt("All time")}
			presets={usageTimeRangePresets}
			className="flex-1 min-w-90 max-w-110 rounded-md bg-accent shadow-xs"
			fieldClassName="border-0 bg-transparent shadow-none focus-within:border-0 focus-within:ring-0"
		/>
	);
}
