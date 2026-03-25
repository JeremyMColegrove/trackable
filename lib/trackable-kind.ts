import type { TrackableKind } from "@/db/schema/types";

const trackableKindLabels = {
	survey: {
		short: "Survey",
		creation: "Survey",
	},
	api_ingestion: {
		short: "Logs",
		creation: "Log ingestion",
	},
} satisfies Record<
	TrackableKind,
	{
		short: string;
		creation: string;
	}
>;

const trackableKindVisuals = {
	survey: {
		accentClassName: "text-blue-600",
		mutedAccentClassName: "text-blue-700",
		iconContainerClassName:
			"bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
		badgeClassName:
			"border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
		borderClassName: "",
		selectedSurfaceClassName:
			"border-blue-300 bg-blue-50/80 dark:bg-blue-500/10",
		chartColor: "#3b82f6",
	},
	api_ingestion: {
		accentClassName: "text-purple-600",
		mutedAccentClassName: "text-purple-700",
		iconContainerClassName:
			"bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
		badgeClassName:
			"border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200",
		borderClassName: "",
		selectedSurfaceClassName:
			"border-purple-300 bg-purple-50/80 dark:bg-purple-500/10",
		chartColor: "#a855f7",
	},
} satisfies Record<
	TrackableKind,
	{
		accentClassName: string;
		mutedAccentClassName: string;
		iconContainerClassName: string;
		badgeClassName: string;
		borderClassName: string;
		selectedSurfaceClassName: string;
		chartColor: string;
	}
>;

export function getTrackableKindShortLabel(kind: TrackableKind) {
	return trackableKindLabels[kind].short;
}

export function getTrackableKindCreationLabel(kind: TrackableKind) {
	return trackableKindLabels[kind].creation;
}

export function getTrackableKindVisuals(kind: TrackableKind) {
	return trackableKindVisuals[kind];
}
