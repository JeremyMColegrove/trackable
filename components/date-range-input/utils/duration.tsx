import { Clock3Icon } from "lucide-react";
import { type DateRangeValue, normalizeDateRangeValue } from "./types";

const MINUTE_IN_MS = 60 * 1000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const WEEK_IN_MS = 7 * DAY_IN_MS;

export { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, WEEK_IN_MS };

export function getDateRangeDurationMs(value: DateRangeValue) {
	const normalizedValue = normalizeDateRangeValue(value);

	return Math.max(
		0,
		normalizedValue.end.getTime() - normalizedValue.start.getTime(),
	);
}

export function formatDateRangeDurationBadge(value: DateRangeValue) {
	if (value.presetKey === "all_time") {
		return <Clock3Icon className="w-4 h-4" />;
	}

	return formatDurationBadge(getDateRangeDurationMs(value));
}

export function formatDurationBadge(durationMs: number) {
	if (durationMs <= 0) {
		return "0m";
	}

	if (durationMs >= WEEK_IN_MS) {
		const weeks = durationMs / WEEK_IN_MS;
		return `${Number.isInteger(weeks) ? weeks : Math.round(weeks)}w`;
	}

	if (durationMs >= DAY_IN_MS) {
		const days = durationMs / DAY_IN_MS;
		return `${Number.isInteger(days) ? days : Math.round(days)}d`;
	}

	if (durationMs >= HOUR_IN_MS) {
		const hours = durationMs / HOUR_IN_MS;
		return `${Number.isInteger(hours) ? hours : Math.round(hours)}h`;
	}

	const minutes = durationMs / MINUTE_IN_MS;
	return `${Math.max(1, Number.isInteger(minutes) ? minutes : Math.round(minutes))}m`;
}
