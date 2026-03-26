"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function TrackableTableEmptyState({
	title,
	description,
	actionHref,
	actionLabel,
	action,
}: {
	title: string;
	description: string;
	actionHref?: string;
	actionLabel?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-3 px-4 py-8 text-center sm:px-6">
			{/* <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </p> */}
			<div className="max-w-md space-y-1">
				<p className="text-sm font-medium text-foreground">{title}</p>
				<p className="text-sm leading-6 text-muted-foreground">{description}</p>
			</div>
			{action ? action : null}
			{!action && actionHref && actionLabel ? (
				<Button asChild size="lg" className="mt-1">
					<Link href={actionHref}>{actionLabel}</Link>
				</Button>
			) : null}
		</div>
	);
}
