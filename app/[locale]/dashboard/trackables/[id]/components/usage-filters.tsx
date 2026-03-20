import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { UsageEventTimeRange } from "@/lib/usage-event-search";
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
	roundedUp,
}: UsageFilterBoxProps) {
	return (
		<div className="flex items-start gap-3">
			{roundedUp && (
				<div
					className={`h-6 w-8 border-b ${roundedUp ? "rounded-bl-3xl border-l" : ""} border-border`}
				/>
			)}
			<div
				className={cn(
					"flex items-center gap-3 rounded-md bg-accent pl-4 shadow-xs",
					className,
				)}
			>
				<div className="text-xs font-semibold tracking-tight uppercase">
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

const usageTimeRangeOptions: Array<{
	label: string;
	value: Exclude<UsageEventTimeRange, "custom">;
}> = [
	{ label: "Last 15 min", value: "last_15_minutes" },
	{ label: "Last 1 hour", value: "last_1_hour" },
	{ label: "Last 24 hours", value: "last_24_hours" },
	{ label: "Last 7 days", value: "last_7_days" },
	{ label: "All time", value: "all_time" },
];

export function UsageTimeRangeFilter({
	value,
	onValueChange,
}: {
	value: Exclude<UsageEventTimeRange, "custom">;
	onValueChange: (value: Exclude<UsageEventTimeRange, "custom">) => void;
}) {
    const gt = useGT();
	return (
		<UsageFilterBox label={gt("Time Range")}>
			<Select
				value={value}
				onValueChange={(nextValue) =>
					onValueChange(nextValue as Exclude<UsageEventTimeRange, "custom">)
				}
			>
				<SelectTrigger className="border-none">
					<SelectValue placeholder={gt("All time")} />
				</SelectTrigger>
				<SelectContent align="end">
					{usageTimeRangeOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</UsageFilterBox>
	);
}
