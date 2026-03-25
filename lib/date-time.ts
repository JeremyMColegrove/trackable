const tableTimestampMonthFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
});

function padNumber(value: number, length = 2) {
	return String(value).padStart(length, "0");
}

export function formatTableTimestamp(value: string | Date | null) {
	if (!value) {
		return "Never";
	}

	const date = value instanceof Date ? value : new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "Invalid date";
	}

	return [
		tableTimestampMonthFormatter.format(date),
		padNumber(date.getDate()),
		`${date.getHours()}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}.${padNumber(date.getMilliseconds(), 3)}`,
	].join(" ");
}
