import "server-only"

import type {
  UsageEventAggregation,
  UsageEventLevel,
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
  UsageEventTableApiKey,
  UsageEventTableResult,
} from "@/lib/usage-event-search"
import type { UsageEventRecord } from "./event-search-filter"

type UsageEventRow = UsageEventTableResult["rows"][number]
type UsageEventHit = UsageEventRow["hits"][number]

type UsageEventGroup = {
  id: string
  event: string | null
  level: UsageEventLevel | null
  message: string | null
  aggregation: UsageEventAggregation
  groupField: string | null
  totalHits: number
  lastOccurredAt: string
  firstOccurredAt: string
  percentage: number
  apiKey: UsageEventTableApiKey | null
  apiKeyCount: number
  apiKeys: UsageEventTableApiKey[]
  hits: UsageEventHit[]
}

// --- Formatting utilities ---

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
      .map((entry): string | null => formatAggregateValue(entry))
      .filter(Boolean)
      .join(", ")
    return formatted || null
  }

  return JSON.stringify(value)
}

function buildColumns(aggregation: UsageEventAggregation) {
  if (aggregation === "payload_field") {
    return [
      { id: "event" as const, label: "Aggregate Value", visible: true },
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

function buildSortComparator(input: UsageEventSearchInput) {
  return (left: UsageEventGroup, right: UsageEventGroup) => {
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

// --- Aggregation Strategies ---

export interface AggregationStrategy {
  aggregate(
    events: UsageEventRecord[],
    input: UsageEventSearchInput,
    sourceSnapshot: UsageEventSourceSnapshot
  ): UsageEventTableResult
}

export class FlatTableStrategy implements AggregationStrategy {
  aggregate(
    filteredEvents: UsageEventRecord[],
    input: UsageEventSearchInput,
    sourceSnapshot: UsageEventSourceSnapshot
  ): UsageEventTableResult {
    const sortedRows = filteredEvents
      .map((event) => {
        const occurredAt = event.occurredAt.toISOString()
        const eventName = extractPayloadString(event.payload, "event")
        const hit: UsageEventHit = {
          id: event.id,
          occurredAt,
          payload: event.payload,
          metadata: event.metadata,
          apiKey: event.apiKey,
        }

        return {
          id: event.id,
          event: eventName,
          level: resolveLogLevel(event.payload),
          message:
            extractPayloadString(event.payload, "message") ??
            extractPayloadString(event.payload, "msg"),
          aggregation: input.aggregation,
          groupField: null,
          totalHits: 1,
          lastOccurredAt: occurredAt,
          firstOccurredAt: occurredAt,
          percentage: filteredEvents.length > 0 ? 100 : 0,
          apiKey: event.apiKey,
          apiKeyCount: 1,
          apiKeys: [event.apiKey],
          hits: [hit],
        } satisfies UsageEventGroup
      })
      .sort(buildSortComparator(input))

    return {
      columns: buildColumns(input.aggregation),
      rows: sortedRows.slice(0, input.limit),
      totalMatchedEvents: filteredEvents.length,
      totalGroupedRows: sortedRows.length,
      availableAggregateFields: [],
      maxLogsFound: false,
      sourceSnapshot,
    }
  }
}

export class GroupedAggregateStrategy implements AggregationStrategy {
  aggregate(
    filteredEvents: UsageEventRecord[],
    input: UsageEventSearchInput,
    sourceSnapshot: UsageEventSourceSnapshot
  ): UsageEventTableResult {
    const aggregateField = input.aggregateField!
    const groupFieldLabel = formatFieldLabel(aggregateField)
    const groups = new Map<string, UsageEventGroup>()

    for (const event of filteredEvents) {
      const aggregateValue = formatAggregateValue(event.payload[aggregateField])
      const groupId = `${aggregateField}:${serializeAggregateValue(event.payload[aggregateField])}`
      const occurredAt = event.occurredAt.toISOString()
      const hit: UsageEventHit = {
        id: event.id,
        occurredAt,
        payload: event.payload,
        metadata: event.metadata,
        apiKey: event.apiKey,
      }

      const existingGroup = groups.get(groupId)

      if (existingGroup) {
        existingGroup.totalHits += 1
        existingGroup.hits.push(hit)

        if (
          new Date(existingGroup.lastOccurredAt).getTime() <
          event.occurredAt.getTime()
        ) {
          existingGroup.lastOccurredAt = occurredAt
        }

        if (
          new Date(existingGroup.firstOccurredAt).getTime() >
          event.occurredAt.getTime()
        ) {
          existingGroup.firstOccurredAt = occurredAt
        }

        if (!existingGroup.apiKeys.some((k) => k.id === event.apiKey.id)) {
          existingGroup.apiKeys.push(event.apiKey)
          existingGroup.apiKeyCount = existingGroup.apiKeys.length
        }

        continue
      }

      groups.set(groupId, {
        id: groupId,
        event: aggregateValue,
        level: null,
        message: null,
        aggregation: input.aggregation,
        groupField: aggregateField,
        totalHits: 1,
        lastOccurredAt: occurredAt,
        firstOccurredAt: occurredAt,
        percentage: 0,
        apiKey: null,
        apiKeyCount: 1,
        apiKeys: [event.apiKey],
        hits: [hit],
      })
    }

    const sortedRows = Array.from(groups.values())
      .map((group) => ({
        ...group,
        percentage:
          filteredEvents.length > 0
            ? Number(
                ((group.totalHits / filteredEvents.length) * 100).toFixed(1)
              )
            : 0,
        hits: [...group.hits].sort(
          (l, r) =>
            new Date(r.occurredAt).getTime() - new Date(l.occurredAt).getTime()
        ),
        apiKeys: [...group.apiKeys].sort((l, r) =>
          l.name.localeCompare(r.name)
        ),
      }))
      .sort(buildSortComparator(input))

    const columns = buildColumns(input.aggregation).map((column) =>
      column.id === "event" ? { ...column, label: groupFieldLabel } : column
    )

    return {
      columns,
      rows: sortedRows.slice(0, input.limit),
      totalMatchedEvents: filteredEvents.length,
      totalGroupedRows: sortedRows.length,
      availableAggregateFields: [],
      maxLogsFound: false,
      sourceSnapshot,
    }
  }
}
