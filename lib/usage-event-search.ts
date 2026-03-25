import { z } from "zod"

export const usageEventAggregationValues = ["none", "payload_field"] as const

export const usageEventTimeRangeValues = [
  "last_15_minutes",
  "last_1_hour",
  "last_24_hours",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "all_time",
  "custom",
] as const

export const usageEventSortFieldValues = [
  "lastOccurredAt",
  "totalHits",
  "event",
] as const

export const usageEventSortDirectionValues = ["asc", "desc"] as const
export const usageEventLevelValues = ["info", "warn", "error", "debug"] as const
export const usageEventBuiltInColumnIdValues = [
  "event",
  "level",
  "message",
  "totalHits",
  "lastOccurredAt",
  "firstOccurredAt",
  "percentage",
] as const
export const usageEventComputedColumnPrefix = "k:"

export const usageEventAggregationSchema = z.enum(usageEventAggregationValues)
export const usageEventTimeRangeSchema = z.enum(usageEventTimeRangeValues)
export const usageEventSortFieldSchema = z.enum(usageEventSortFieldValues)
export const usageEventSortDirectionSchema = z.enum(
  usageEventSortDirectionValues
)
export const usageEventLevelSchema = z.enum(usageEventLevelValues)
export const usageEventBuiltInColumnIdSchema = z.enum(
  usageEventBuiltInColumnIdValues
)

export const usageEventSourceSnapshotSchema = z.object({
  totalEventCount: z.number().int().min(0),
  latestOccurredAt: z.string().datetime().nullable(),
})

export const usageEventSearchInputSchema = z.object({
  trackableId: z.string().uuid(),
  query: z.string().trim().max(500).default(""),
  aggregation: usageEventAggregationSchema.default("none"),
  aggregateField: z.string().trim().min(1).max(100).nullable().default(null),
  sort: usageEventSortFieldSchema.default("lastOccurredAt"),
  dir: usageEventSortDirectionSchema.default("desc"),
  from: z.string().datetime().nullable().default(null),
  to: z.string().datetime().nullable().default(null),
  limit: z.number().int().min(1).max(200).default(50),
})

export const usageEventUrlStateSchema = z.object({
  q: z.string().optional(),
  aggregate: z.string().trim().min(1).max(100).optional(),
  range: usageEventTimeRangeSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  cols: z.string().trim().min(1).max(2_000).optional(),
})

export const usageEventTableApiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  maskedKey: z.string(),
})

export const usageHitRowSchema = z.object({
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
  metadata: z.string().nullable(),
  apiKey: usageEventTableApiKeySchema,
})

export const usageEventTableRowSchema = z.object({
  id: z.string(),
  event: z.string().nullable(),
  level: usageEventLevelSchema.nullable(),
  message: z.string().nullable(),
  aggregation: usageEventAggregationSchema,
  groupField: z.string().nullable(),
  totalHits: z.number().int().min(0),
  lastOccurredAt: z.string().datetime(),
  firstOccurredAt: z.string().datetime(),
  percentage: z.number().min(0).max(100),
  apiKey: usageEventTableApiKeySchema.nullable(),
  apiKeyCount: z.number().int().min(0),
  apiKeys: z.array(usageEventTableApiKeySchema),
  hits: z.array(usageHitRowSchema),
})

export const usageEventTableColumnSchema = z.object({
  id: usageEventBuiltInColumnIdSchema,
  label: z.string(),
  visible: z.boolean(),
})

export const usageEventTableResultSchema = z.object({
  columns: z.array(usageEventTableColumnSchema),
  rows: z.array(usageEventTableRowSchema),
  totalMatchedEvents: z.number().int().min(0),
  totalGroupedRows: z.number().int().min(0),
  availableAggregateFields: z.array(z.string()),
  maxLogsFound: z.boolean(),
  sourceSnapshot: usageEventSourceSnapshotSchema,
})

export const usageEventFreshnessSchema = z.object({
  hasUpdates: z.boolean(),
  latestOccurredAt: z.string().datetime().nullable(),
  latestEventCount: z.number().int().min(0),
})

export type UsageEventAggregation = z.infer<typeof usageEventAggregationSchema>
export type UsageEventTimeRange = z.infer<typeof usageEventTimeRangeSchema>
export type UsageEventSortField = z.infer<typeof usageEventSortFieldSchema>
export type UsageEventSortDirection = z.infer<
  typeof usageEventSortDirectionSchema
>
export type UsageEventLevel = z.infer<typeof usageEventLevelSchema>
export type UsageEventBuiltInColumnId = z.infer<
  typeof usageEventBuiltInColumnIdSchema
>
export type UsageEventVisibleColumnId =
  | UsageEventBuiltInColumnId
  | `${typeof usageEventComputedColumnPrefix}${string}`
export type UsageEventSearchInput = z.infer<typeof usageEventSearchInputSchema>
export type UsageEventUrlState = z.infer<typeof usageEventUrlStateSchema>
export type UsageEventSourceSnapshot = z.infer<
  typeof usageEventSourceSnapshotSchema
>
export type UsageEventTableApiKey = z.infer<typeof usageEventTableApiKeySchema>
export type UsageHitRow = z.infer<typeof usageHitRowSchema>
export type UsageEventTableRow = z.infer<typeof usageEventTableRowSchema>
export type UsageEventTableColumn = z.infer<typeof usageEventTableColumnSchema>
export type UsageEventTableResult = z.infer<typeof usageEventTableResultSchema>
export type UsageEventFreshness = z.infer<typeof usageEventFreshnessSchema>
export type UsageEventPresetTimeRange = Exclude<
  UsageEventTimeRange,
  "all_time" | "custom"
>

export const usageEventPresetRangeDefinitions: Array<{
  durationMs: number | null
  label: string
  range: UsageEventTimeRange
}> = [
  {
    durationMs: 15 * 60 * 1000,
    label: "Last 15 min",
    range: "last_15_minutes",
  },
  {
    durationMs: 60 * 60 * 1000,
    label: "Last 1 hour",
    range: "last_1_hour",
  },
  {
    durationMs: 24 * 60 * 60 * 1000,
    label: "Last 24 hours",
    range: "last_24_hours",
  },
  {
    durationMs: 7 * 24 * 60 * 60 * 1000,
    label: "Last 7 days",
    range: "last_7_days",
  },
  {
    durationMs: 30 * 24 * 60 * 60 * 1000,
    label: "Last 1 month",
    range: "last_30_days",
  },
  {
    durationMs: 90 * 24 * 60 * 60 * 1000,
    label: "Last 3 months",
    range: "last_90_days",
  },
  {
    durationMs: null,
    label: "All time",
    range: "all_time",
  },
]

export const defaultUsageEventUrlState = {
  q: "",
  aggregate: undefined,
  range: "all_time",
  from: undefined,
  to: undefined,
  limit: "50",
  cols: undefined,
} as const satisfies UsageEventUrlState

function coerceSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export function normalizeUsageEventUrlState(
  params:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | null
    | undefined
) {
  const rawState =
    params instanceof URLSearchParams
      ? {
          q: params.get("q") ?? undefined,
          aggregate: params.get("aggregate") ?? undefined,
          range: params.get("range") ?? undefined,
          from: params.get("from") ?? undefined,
          to: params.get("to") ?? undefined,
          limit: params.get("limit") ?? undefined,
          cols: params.get("cols") ?? undefined,
        }
      : {
          q: coerceSingleValue(params?.q),
          aggregate: coerceSingleValue(params?.aggregate),
          range: coerceSingleValue(params?.range),
          from: coerceSingleValue(params?.from),
          to: coerceSingleValue(params?.to),
          limit: coerceSingleValue(params?.limit),
          cols: coerceSingleValue(params?.cols),
        }

  const parsedUrlState = usageEventUrlStateSchema.safeParse(rawState)

  const normalizedUrlState: UsageEventUrlState = {
    q: parsedUrlState.success
      ? parsedUrlState.data.q
      : defaultUsageEventUrlState.q,
    aggregate: parsedUrlState.success
      ? parsedUrlState.data.aggregate
      : undefined,
    range: parsedUrlState.success
      ? (parsedUrlState.data.range ?? defaultUsageEventUrlState.range)
      : defaultUsageEventUrlState.range,
    from: parsedUrlState.success ? parsedUrlState.data.from : undefined,
    to: parsedUrlState.success ? parsedUrlState.data.to : undefined,
    limit: parsedUrlState.success
      ? (parsedUrlState.data.limit ?? defaultUsageEventUrlState.limit)
      : defaultUsageEventUrlState.limit,
    cols: parsedUrlState.success ? parsedUrlState.data.cols : undefined,
  }

  return normalizedUrlState
}

export function resolveUsageEventTimeRange(urlState: UsageEventUrlState) {
  if (urlState.range) {
    return urlState.range
  }

  if (urlState.from || urlState.to) {
    return "custom"
  }

  return defaultUsageEventUrlState.range
}

export function getUsageEventPresetRange(
  range: Exclude<UsageEventTimeRange, "custom">,
  now: Date
) {
  const preset = usageEventPresetRangeDefinitions.find(
    (candidate) => candidate.range === range
  )

  if (!preset) {
    return null
  }

  if (preset.durationMs === null) {
    return {
      from: new Date(0).toISOString(),
      to: now.toISOString(),
    }
  }

  return {
    from: new Date(now.getTime() - preset.durationMs).toISOString(),
    to: now.toISOString(),
  }
}

export function buildUsageEventSearchInput(
  trackableId: string,
  urlState: UsageEventUrlState
): UsageEventSearchInput {
  const aggregateField = urlState.aggregate?.trim() || null
  const selectedRange = resolveUsageEventTimeRange(urlState)
  const now = new Date()
  const resolvedRange =
    selectedRange === "all_time"
      ? { from: null, to: null }
      : selectedRange === "custom"
        ? {
            from: urlState.from ?? null,
            to: urlState.to ?? null,
          }
        : (getUsageEventPresetRange(selectedRange, now) ?? {
            from: null,
            to: null,
          })

  return usageEventSearchInputSchema.parse({
    trackableId,
    query: urlState.q ?? defaultUsageEventUrlState.q,
    aggregation: aggregateField ? "payload_field" : "none",
    aggregateField,
    sort: "lastOccurredAt",
    dir: "desc",
    from: resolvedRange.from,
    to: resolvedRange.to,
    limit: Number(urlState.limit ?? defaultUsageEventUrlState.limit),
  })
}

export function buildUsageEventUrlSearchParams(urlState: UsageEventUrlState) {
  const normalizedUrlState = normalizeUsageEventUrlState(urlState)
  const params = new URLSearchParams()
  const limit = normalizedUrlState.limit ?? defaultUsageEventUrlState.limit

  if (normalizedUrlState.q?.trim()) {
    params.set("q", normalizedUrlState.q.trim())
  }

  if (normalizedUrlState.aggregate?.trim()) {
    params.set("aggregate", normalizedUrlState.aggregate.trim())
  }

  if (normalizedUrlState.range && normalizedUrlState.range !== "all_time") {
    params.set("range", normalizedUrlState.range)
  }

  if (normalizedUrlState.range === "custom" && normalizedUrlState.from) {
    params.set("from", normalizedUrlState.from)
  }

  if (normalizedUrlState.range === "custom" && normalizedUrlState.to) {
    params.set("to", normalizedUrlState.to)
  }

  if (limit !== defaultUsageEventUrlState.limit) {
    params.set("limit", limit)
  }

  if (normalizedUrlState.cols?.trim()) {
    params.set("cols", normalizedUrlState.cols.trim())
  }

  return params
}

export function isUsageEventBuiltInColumnId(
  value: string
): value is UsageEventBuiltInColumnId {
  return usageEventBuiltInColumnIdValues.includes(
    value as UsageEventBuiltInColumnId
  )
}

export function createUsageEventComputedColumnId(
  field: string
): UsageEventVisibleColumnId {
  return `${usageEventComputedColumnPrefix}${field.trim()}`
}

export function isUsageEventComputedColumnId(
  value: string
): value is `${typeof usageEventComputedColumnPrefix}${string}` {
  return value.startsWith(usageEventComputedColumnPrefix)
}

export function getUsageEventComputedColumnField(value: string): string | null {
  if (!isUsageEventComputedColumnId(value)) {
    return null
  }

  const field = value.slice(usageEventComputedColumnPrefix.length).trim()

  if (!field || field.length > 100) {
    return null
  }

  return field
}

export function parseUsageEventVisibleColumnIds(
  value: string | null | undefined
) {
  if (!value?.trim()) {
    return []
  }

  const columnIds: UsageEventVisibleColumnId[] = []
  const seenColumnIds = new Set<UsageEventVisibleColumnId>()

  for (const rawColumnId of value.split(",")) {
    const decodedColumnId = decodeURIComponent(rawColumnId).trim()

    if (!decodedColumnId) {
      continue
    }

    if (isUsageEventBuiltInColumnId(decodedColumnId)) {
      if (!seenColumnIds.has(decodedColumnId)) {
        seenColumnIds.add(decodedColumnId)
        columnIds.push(decodedColumnId)
      }

      continue
    }

    const computedField = getUsageEventComputedColumnField(decodedColumnId)

    if (!computedField) {
      continue
    }

    const computedColumnId = createUsageEventComputedColumnId(computedField)

    if (seenColumnIds.has(computedColumnId)) {
      continue
    }

    seenColumnIds.add(computedColumnId)
    columnIds.push(computedColumnId)
  }

  return columnIds
}

export function stringifyUsageEventVisibleColumnIds(
  columnIds: UsageEventVisibleColumnId[]
) {
  if (columnIds.length === 0) {
    return undefined
  }

  return columnIds.map((columnId) => encodeURIComponent(columnId)).join(",")
}

export function buildAppliedUsageEventTimeRangeUrlState(
  input: Pick<UsageEventSearchInput, "from" | "to">
): Pick<UsageEventUrlState, "range" | "from" | "to"> {
  if (!input.from && !input.to) {
    return {
      range: undefined,
      from: undefined,
      to: undefined,
    }
  }

  return {
    range: "custom",
    from: input.from ?? undefined,
    to: input.to ?? undefined,
  }
}
