import type {
  UsageEventLevel,
  UsageEventSearchInput,
  UsageEventTableApiKey,
  UsageEventTableResult,
} from "@/lib/usage-event-search"
import type {
  UsageEventGroupedRow,
  UsageEventRecord,
  UsageEventSortDescriptor,
} from "@/server/usage-tracking/usage-event-query.types"

type UsageEventRow = UsageEventTableResult["rows"][number]
type UsageEventHit = UsageEventRow["hits"][number]

export function collectUsageEventAggregateFields(
  payloads: Array<Record<string, unknown>>
) {
  const fields = new Set<string>()

  for (const payload of payloads) {
    for (const key of Object.keys(payload)) {
      fields.add(key)
    }
  }

  return Array.from(fields).sort((left, right) => left.localeCompare(right))
}

export function quoteSqlStringLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

export function normalizeDateValue(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

export function extractPayloadString(
  payload: Record<string, unknown>,
  key: string
): string | null {
  const value = payload[key]

  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  return null
}

export function resolveLogLevel(
  payload: Record<string, unknown>
): UsageEventLevel | null {
  const rawLevel = extractPayloadString(payload, "level")

  switch (rawLevel?.trim().toLowerCase()) {
    case "info":
    case "warn":
    case "error":
    case "debug":
      return rawLevel.trim().toLowerCase() as UsageEventLevel
    case "warning":
      return "warn"
    case "ok":
    case "success":
      return "info"
    default:
      return null
  }
}

export function formatFieldLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

export function buildUsageEventColumns(
  aggregation: UsageEventSearchInput["aggregation"],
  aggregateField: string | null
) {
  if (aggregation === "payload_field" && aggregateField) {
    return [
      {
        id: "event" as const,
        label: formatFieldLabel(aggregateField),
        visible: true,
      },
      { id: "totalHits" as const, label: "Hits", visible: true },
      { id: "lastOccurredAt" as const, label: "Last Seen", visible: true },
      { id: "firstOccurredAt" as const, label: "First Seen", visible: true },
      { id: "percentage" as const, label: "%", visible: true },
    ]
  }

  return [
    { id: "lastOccurredAt" as const, label: "Timestamp", visible: true },
    { id: "event" as const, label: "Event", visible: true },
    { id: "level" as const, label: "Level", visible: true },
    { id: "message" as const, label: "Message", visible: true },
  ]
}

type SortableUsageEventRow = {
  event: string | null
  lastOccurredAt: string
  totalHits: number
}

export function buildUsageEventRowComparator(input: UsageEventSortDescriptor) {
  return (left: SortableUsageEventRow, right: SortableUsageEventRow) => {
    switch (input.sort) {
      case "event":
        return input.dir === "asc"
          ? (left.event ?? "").localeCompare(right.event ?? "")
          : (right.event ?? "").localeCompare(left.event ?? "")
      case "totalHits":
        return input.dir === "asc"
          ? left.totalHits - right.totalHits ||
              (left.event ?? "").localeCompare(right.event ?? "")
          : right.totalHits - left.totalHits ||
              (right.event ?? "").localeCompare(left.event ?? "")
      case "lastOccurredAt":
      default:
        return input.dir === "asc"
          ? new Date(left.lastOccurredAt).getTime() -
              new Date(right.lastOccurredAt).getTime() ||
              (left.event ?? "").localeCompare(right.event ?? "")
          : new Date(right.lastOccurredAt).getTime() -
              new Date(left.lastOccurredAt).getTime() ||
              (right.event ?? "").localeCompare(left.event ?? "")
    }
  }
}

export function buildUsageEventHit(event: UsageEventRecord): UsageEventHit {
  return {
    id: event.id,
    occurredAt: event.occurredAt.toISOString(),
    payload: event.payload,
    metadata: event.metadata,
    apiKey: event.apiKey,
  }
}

export function buildFlatUsageEventRow(
  event: UsageEventRecord,
  totalMatchedEvents: number
) {
  const occurredAt = event.occurredAt.toISOString()

  return {
    id: event.id,
    event: extractPayloadString(event.payload, "event"),
    level: resolveLogLevel(event.payload),
    message:
      extractPayloadString(event.payload, "message") ??
      extractPayloadString(event.payload, "msg"),
    aggregation: "none" as const,
    groupField: null,
    totalHits: 1,
    lastOccurredAt: occurredAt,
    firstOccurredAt: occurredAt,
    percentage: totalMatchedEvents > 0 ? 100 : 0,
    apiKey: event.apiKey,
    apiKeyCount: 1,
    apiKeys: [event.apiKey],
    hits: [buildUsageEventHit(event)],
  } satisfies UsageEventRow
}

export function buildGroupedUsageEventRow(
  row: UsageEventGroupedRow,
  aggregateField: string,
  totalMatchedEvents: number
) {
  return {
    id: row.id,
    event: row.groupValue,
    level: null,
    message: null,
    aggregation: "payload_field" as const,
    groupField: aggregateField,
    totalHits: row.totalHits,
    lastOccurredAt: row.lastOccurredAt.toISOString(),
    firstOccurredAt: row.firstOccurredAt.toISOString(),
    percentage:
      totalMatchedEvents > 0
        ? Number(((row.totalHits / totalMatchedEvents) * 100).toFixed(1))
        : 0,
    apiKey: null,
    apiKeyCount: row.apiKeys.length,
    apiKeys: [...row.apiKeys].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    hits: [],
  } satisfies UsageEventRow
}

export function groupUsageEventsByField(
  events: UsageEventRecord[],
  aggregateField: string
): UsageEventGroupedRow[] {
  const groups = new Map<
    string,
    {
      apiKeys: Map<string, UsageEventTableApiKey>
      firstOccurredAt: Date
      groupValue: string | null
      id: string
      lastOccurredAt: Date
      totalHits: number
    }
  >()

  for (const event of events) {
    const groupValue = formatAggregateValue(event.payload[aggregateField])
    const id = `${aggregateField}:${serializeAggregateValue(event.payload[aggregateField])}`
    const existingGroup = groups.get(id)

    if (existingGroup) {
      existingGroup.totalHits += 1

      if (event.occurredAt < existingGroup.firstOccurredAt) {
        existingGroup.firstOccurredAt = event.occurredAt
      }

      if (event.occurredAt > existingGroup.lastOccurredAt) {
        existingGroup.lastOccurredAt = event.occurredAt
      }

      existingGroup.apiKeys.set(event.apiKey.id, event.apiKey)
      continue
    }

    groups.set(id, {
      apiKeys: new Map([[event.apiKey.id, event.apiKey]]),
      firstOccurredAt: event.occurredAt,
      groupValue,
      id,
      lastOccurredAt: event.occurredAt,
      totalHits: 1,
    })
  }

  return Array.from(groups.values()).map((group) => ({
    apiKeys: Array.from(group.apiKeys.values()),
    firstOccurredAt: group.firstOccurredAt,
    groupValue: group.groupValue,
    id: group.id,
    lastOccurredAt: group.lastOccurredAt,
    totalHits: group.totalHits,
  }))
}

function serializeAggregateValue(value: unknown): string {
  if (value === null || value === undefined) return "__empty__"
  if (typeof value === "string") return value.trim() || "__empty__"
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }

  return JSON.stringify(value)
}

function formatAggregateValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value.trim() || null
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }

  if (Array.isArray(value)) {
    const formatted = value
      .map((entry) => formatAggregateValue(entry))
      .filter(Boolean)
      .join(", ")

    return formatted || null
  }

  return JSON.stringify(value)
}
