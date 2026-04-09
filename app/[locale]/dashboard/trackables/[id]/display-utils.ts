import type {
  FormAnswerValue,
  FormFieldConfig,
  SubmissionMetadata,
  UsageEventPayload,
} from "@/db/schema/types"
import {
  formatUserTimestamp,
  formatUserTimestampWithSeconds,
} from "@/lib/date-time"

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
})

type TranslateFn = (value: string) => string

function identity(value: string) {
  return value
}

export function formatRelativeTime(
  value: string | null,
  gt: TranslateFn = identity
) {
  if (!value) {
    return gt("Never")
  }

  const timestamp = new Date(value).getTime()
  const diffMs = timestamp - Date.now()
  const absSeconds = Math.round(Math.abs(diffMs) / 1000)

  if (absSeconds < 60) {
    return relativeTimeFormatter.format(Math.round(diffMs / 1000), "second")
  }

  const absMinutes = Math.round(absSeconds / 60)
  if (absMinutes < 60) {
    return relativeTimeFormatter.format(
      Math.round(diffMs / (60 * 1000)),
      "minute"
    )
  }

  const absHours = Math.round(absMinutes / 60)
  if (absHours < 24) {
    return relativeTimeFormatter.format(
      Math.round(diffMs / (60 * 60 * 1000)),
      "hour"
    )
  }

  return relativeTimeFormatter.format(
    Math.round(diffMs / (24 * 60 * 60 * 1000)),
    "day"
  )
}

export function formatDateTime(value: string | null) {
  return formatUserTimestamp(value)
}

export function formatCompactDateTime(value: string | null) {
  return formatUserTimestampWithSeconds(value)
}

export function formatStatusLabel(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
}

export function formatSubmissionSource(
  value: string,
  gt: TranslateFn = identity
) {
  switch (value) {
    case "public_link":
      return gt("Public link")
    case "user_grant":
      return gt("Shared user")
    case "email_grant":
      return gt("Shared email")
    default:
      return value
  }
}

export function formatFieldKind(value: string, gt: TranslateFn = identity) {
  switch (value) {
    case "rating":
      return gt("Quick rating")
    case "checkboxes":
      return gt("Checkboxes")
    case "notes":
      return gt("Notes")
    case "short_text":
      return gt("Short text")
    case "file_upload":
      return gt("File upload")
    case "youtube_video":
      return gt("YouTube video")
    default:
      return value
  }
}

export function formatFieldConfigSummary(
  config: FormFieldConfig,
  gt: TranslateFn = identity
) {
  switch (config.kind) {
    case "rating":
      return `${config.scale}-${gt("point scale")}`
    case "checkboxes":
      return `${config.options.length} ${gt(
        config.options.length === 1 ? "option" : "options"
      )}`
    case "notes":
      return config.maxLength
        ? `${gt("Up to")} ${config.maxLength} ${gt("characters")}`
        : gt("Free text")
    case "short_text":
      return config.maxLength
        ? `${gt("Up to")} ${config.maxLength} ${gt("characters")}`
        : gt("Single line")
    case "file_upload":
      return config.asset
        ? config.asset.kind === "image"
          ? gt("Displays uploaded image")
          : gt("Displays downloadable file")
        : gt("No asset selected")
    case "youtube_video":
      return gt("Embedded player")
    default:
      return gt("Configured field")
  }
}

export function formatAnswerValue(
  value: FormAnswerValue | undefined,
  gt: TranslateFn = identity
) {
  if (!value) {
    return gt("No response")
  }

  switch (value.kind) {
    case "rating":
      return `${value.value}`
    case "checkboxes":
      return value.value.length > 0 ? value.value.join(", ") : gt("No selections")
    case "notes":
      return value.value.trim() ? value.value : gt("No response")
    case "short_text":
      return value.value.trim() ? value.value : gt("No response")
    default:
      return gt("No response")
  }
}

export function formatMetadataEntries(metadata: SubmissionMetadata | null) {
  if (!metadata) {
    return []
  }

  return Object.entries(metadata)
    .filter(([, value]) => value)
    .map(([key, value]) => ({
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (char) => char.toUpperCase()),
      value: String(value),
    }))
}

export function formatUsageFieldValue(value: unknown): string {
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
    return value
      .map((entry) => formatUsageFieldValue(entry))
      .filter(Boolean)
      .join(", ")
  }

  return JSON.stringify(value)
}

export function formatUsagePayload(payload: UsageEventPayload) {
  return Object.entries(payload)
    .filter(
      ([key, value]) => key !== "name" && value !== null && value !== undefined
    )
    .map(([key, value]) => `${key}: ${formatUsageFieldValue(value)}`)
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

export function formatUsageUserAgent(
  metadata: Record<string, unknown> | null,
  gt: TranslateFn = identity
) {
  if (!metadata) {
    return gt("No user agent")
  }

  const userAgent = metadata.userAgent

  return typeof userAgent === "string" && userAgent.trim()
    ? userAgent
    : gt("No user agent")
}
