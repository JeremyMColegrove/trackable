/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: <explanation> */
"use client";

import { Laptop, Monitor, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type SignedInDeviceLocation = {
	displayLabel: string;
};

export type SignedInDevice = {
	browserLabel: string;
	createdAt: Date | string;
	deviceLabel: string;
	isCurrent: boolean;
	location: SignedInDeviceLocation;
	osLabel: string;
	token: string;
};

function formatLastLogin(value: Date | string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getSessionMetaLine(session: SignedInDevice) {
	const deviceParts = [session.browserLabel, session.osLabel].filter(
		(value) => !value.startsWith("Unknown"),
	);
	const deviceSummary =
		deviceParts.length > 0
			? deviceParts.join(" / ")
			: "Device details unavailable";

	return `${deviceSummary} | ${session.location.displayLabel}`;
}

function getDeviceIcon(session: SignedInDevice) {
	const normalizedLabel = session.deviceLabel.toLowerCase();
	const normalizedOs = session.osLabel.toLowerCase();

	if (
		normalizedLabel.includes("iphone") ||
		normalizedLabel.includes("ipad") ||
		normalizedLabel.includes("android") ||
		normalizedOs === "ios" ||
		normalizedOs === "android"
	) {
		return Smartphone;
	}

	if (
		normalizedLabel.includes("mac") ||
		normalizedLabel.includes("pc") ||
		normalizedLabel.includes("chromebook") ||
		normalizedLabel.includes("linux")
	) {
		return Laptop;
	}

	return Monitor;
}

type SignedInDevicesSectionProps = {
	isLoading?: boolean;
	isPendingRevoke?: boolean;
	sessions: SignedInDevice[];
};

export function SignedInDevicesSection({
	isLoading = false,
	isPendingRevoke = false,
	sessions,
}: SignedInDevicesSectionProps) {
	if (isLoading) {
		return (
			<div className="space-y-3" aria-label="Loading signed-in devices">
				<div className="rounded-xl border border-border/70 p-4">
					<div className="h-4 w-32 animate-pulse rounded bg-muted" />
					<div className="mt-2 h-3 w-56 animate-pulse rounded bg-muted" />
				</div>
			</div>
		);
	}

	if (sessions.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No active signed-in devices were found.
			</p>
		);
	}

	return (
		<div className="space-y-3">
			{sessions.map((session, index) => (
				<div key={session.token}>
					{index > 0 ? <Separator className="mb-3" /> : null}
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-1">
							<div className="flex flex-wrap items-center gap-2">
								<span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
									{(() => {
										const DeviceIcon = getDeviceIcon(session);
										return <DeviceIcon className="size-4" aria-hidden="true" />;
									})()}
								</span>
								<p className="text-sm font-medium text-foreground">
									{session.deviceLabel}
								</p>
								{session.isCurrent ? (
									<Badge variant="secondary">This device</Badge>
								) : null}
							</div>
							<p className="text-sm text-muted-foreground">
								{getSessionMetaLine(session)}
							</p>
							<p className="text-sm text-muted-foreground">
								Last login {formatLastLogin(session.createdAt)}
							</p>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
