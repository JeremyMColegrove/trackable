type TimestampFormatOptions = {
	includeSeconds?: boolean
}

const monthFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
})

function padNumber(value: number) {
	return String(value).padStart(2, "0")
}

function formatTimestamp(
	value: string | Date | null,
	{ includeSeconds = false }: TimestampFormatOptions = {}
) {
	if (!value) {
		return "Never"
	}

	const date = value instanceof Date ? value : new Date(value)

	if (Number.isNaN(date.getTime())) {
		return "Invalid date"
	}

	const hour24 = date.getHours()
	const hour12 = hour24 % 12 || 12
	const minute = padNumber(date.getMinutes())
	const second = padNumber(date.getSeconds())
	const dayPeriod = hour24 >= 12 ? "pm" : "am"
	const timeLabel = includeSeconds
		? `${hour12}:${minute}.${second} ${dayPeriod}`
		: `${hour12}:${minute} ${dayPeriod}`

	return `${monthFormatter.format(date)} ${date.getDate()}, ${timeLabel}`
}

export function formatUserTimestamp(value: string | Date | null) {
	return formatTimestamp(value)
}

export function formatUserTimestampWithSeconds(value: string | Date | null) {
	return formatTimestamp(value, { includeSeconds: true })
}

export function formatTableTimestamp(value: string | Date | null) {
	return formatUserTimestamp(value)
}
