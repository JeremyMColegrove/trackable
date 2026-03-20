"use client";

import type { UsageEventLevel } from "@/lib/usage-event-search";
import { cn } from "@/lib/utils";

import { formatStatusLabel } from "./display-utils";

const logLevelClasses: Record<UsageEventLevel, string> = {
	info:
		"border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
	warn: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
	error:
		"border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
	debug:
		"border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300",
};

export function getLogLevelClassName(level: UsageEventLevel) {
	return logLevelClasses[level];
}

export function LogLevelBadge({ level }: { level: UsageEventLevel | null }) {
	if (!level) {
		return <span className="text-sm text-muted-foreground">—</span>;
	}

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
				getLogLevelClassName(level),
			)}
		>
			{formatStatusLabel(level)}
		</span>
	);
}
