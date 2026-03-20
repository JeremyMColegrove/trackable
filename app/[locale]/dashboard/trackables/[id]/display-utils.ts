import type {
  FormAnswerValue,
  FormFieldConfig,
  SubmissionMetadata,
  UsageEventPayload,
} from "@/db/schema/types"

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
})

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Never"
  }

  const timestamp = new Date(value).getTime()
  const diffMs = timestamp - Date.now()
  const absSeconds = Math.round(Math.abs(diffMs) / 1000)

  if (absSeconds < 60) {
    return relativeTimeFormatter.format(Math.round(diffMs / 1000), "second")
  }

  const absMinutes = Math.round(absSeconds / 60)
  if (absMinutes < 60) {
    return relativeTimeFormatter.format(Math.round(diffMs / (60 * 1000)), "minute")
  }

  const absHours = Math.round(absMinutes / 60)
  if (absHours < 24) {
    return relativeTimeFormatter.format(Math.round(diffMs / (60 * 60 * 1000)), "hour")
  }

  return relativeTimeFormatter.format(Math.round(diffMs / (24 * 60 * 60 * 1000)), "day")
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Never"
  }

  return dateTimeFormatter.format(new Date(value))
}

export function formatStatusLabel(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
}

export function formatSubmissionSource(value: string) {
  switch (value) {
    case "public_link":
      return "Public link"
    case "user_grant":
      return "Shared user"
    case "email_grant":
      return "Shared email"
    default:
      return value
  }
}

export function formatFieldKind(value: string) {
  switch (value) {
    case "rating":
      return "Quick rating"
    case "checkboxes":
      return "Checkboxes"
    case "notes":
      return "Notes"
    case "short_text":
      return "Short text"
    default:
      return value
  }
}

export function formatFieldConfigSummary(config: FormFieldConfig) {
  switch (config.kind) {
    case "rating":
      return `${config.scale}-point scale`
    case "checkboxes":
      return `${config.options.length} option${config.options.length === 1 ? "" : "s"}`
    case "notes":
      return config.maxLength ? `Up to ${config.maxLength} characters` : "Free text"
    case "short_text":
      return config.maxLength ? `Up to ${config.maxLength} characters` : "Single line"
    default:
      return "Configured field"
  }
}

export function formatAnswerValue(value: FormAnswerValue | undefined) {
  if (!value) {
    return "No response"
  }

  switch (value.kind) {
    case "rating":
      return `${value.value}`
    case "checkboxes":
      return value.value.length > 0 ? value.value.join(", ") : "No selections"
    case "notes":
      return value.value.trim() ? value.value : "No response"
    case "short_text":
      return value.value.trim() ? value.value : "No response"
    default:
      return "No response"
  }
}

export function formatMetadataEntries(metadata: SubmissionMetadata | null) {
  if (!metadata) {
    return []
  }

  return Object.entries(metadata)
    .filter(([, value]) => value)
    .map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
      value: String(value),
    }))
}

function formatUsageValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatUsageValue(entry)).filter(Boolean).join(", ")
  }

  return JSON.stringify(value)
}

export function formatUsagePayload(payload: UsageEventPayload) {
  return Object.entries(payload)
    .filter(([key, value]) => key !== "name" && value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${formatUsageValue(value)}`)
    .join("; ")
}

export function formatUsageFieldLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

export function formatUsageUserAgent(metadata: string | null) {
  if (!metadata) {
    return "No user agent"
  }

  try {
    const parsedMetadata = JSON.parse(metadata) as Record<string, unknown>
    const userAgent = parsedMetadata.userAgent

    return typeof userAgent === "string" && userAgent.trim()
      ? userAgent
      : "No user agent"
  } catch {
    return "No user agent"
  }
}
