import type { LiqeQuery } from "liqe"

import type {
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
  UsageEventTableApiKey,
  UsageEventTableResult,
} from "@/lib/usage-event-search"

export const MAX_USAGE_EVENT_QUERY_ROWS = 1_000

export type UsageEventRecord = {
  id: string
  occurredAt: Date
  payload: Record<string, unknown>
  metadata: string | null
  apiKey: UsageEventTableApiKey
}

export type UsageEventSortDescriptor = Pick<
  UsageEventSearchInput,
  "dir" | "sort"
>

export type UsageEventQueryValue = boolean | null | string

export type UsageEventQueryExpression =
  | { kind: "empty" }
  | {
      kind: "logical"
      operator: "and" | "or"
      left: UsageEventQueryExpression
      right: UsageEventQueryExpression
    }
  | {
      kind: "not"
      operand: UsageEventQueryExpression
    }
  | {
      kind: "comparison"
      fieldPath: string[] | null
      operator: "eq" | "gt" | "gte" | "lt" | "lte"
      value: UsageEventQueryValue
    }
  | {
      kind: "range"
      fieldPath: string[] | null
      min: number
      minInclusive: boolean
      max: number
      maxInclusive: boolean
    }
  | {
      kind: "regex"
      fieldPath: string[] | null
      value: string
    }

export type UsageEventSqlField =
  | {
      kind: "payload"
      key: string
    }
  | {
      kind: "apiKey"
      key: "id" | "name"
    }

export type UsageEventSqlPredicate = {
  field: UsageEventSqlField
  operator: "eq"
  value: UsageEventQueryValue
}

export type ParsedUsageEventSearch = {
  aggregateField: string | null
  expression: UsageEventQueryExpression
  input: UsageEventSearchInput
  normalizedQuery: string
  matchesRecord: (record: UsageEventRecord) => boolean
}

export type QueryExecutionMode = "flat" | "grouped"
export type QueryEvaluationMode = "sql_only" | "sql_plus_fallback"

export type UsageEventExecutionPlan = {
  aggregateField: string | null
  evaluationMode: QueryEvaluationMode
  executionMode: QueryExecutionMode
  input: UsageEventSearchInput
  sqlPredicates: UsageEventSqlPredicate[]
}

export type UsageEventFlatQueryResult = {
  rows: UsageEventRecord[]
}

export type UsageEventGroupedRow = {
  apiKeys: UsageEventTableApiKey[]
  firstOccurredAt: Date
  groupValue: string | null
  id: string
  lastOccurredAt: Date
  totalHits: number
}

export type UsageEventGroupedQueryResult = {
  rows: UsageEventGroupedRow[]
  totalGroupedRows: number
  totalMatchedEvents: number
}

export type UsageEventAvailableFieldsQueryResult = {
  payloads: Array<Record<string, unknown>>
}

export type UsageEventSqlRepositoryContract = {
  countFlatRows(plan: UsageEventExecutionPlan): Promise<number>
  fetchAvailableAggregateFields(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventAvailableFieldsQueryResult>
  fetchFlatRows(
    plan: UsageEventExecutionPlan,
    options?: { limit?: number }
  ): Promise<UsageEventFlatQueryResult>
  fetchGroupedRows(
    plan: UsageEventExecutionPlan,
    options?: { limit?: number }
  ): Promise<UsageEventGroupedQueryResult>
}

export type OverflowState = {
  maxLogsFound: boolean
  partialResults: boolean
}

export type UsageEventPipelineResult = UsageEventTableResult & {
  overflowState: OverflowState
}

export type UsageEventResultBuilderInput =
  | {
      availableAggregateFields: string[]
      input: UsageEventSearchInput
      mode: "flat"
      overflowState: OverflowState
      rows: UsageEventRecord[]
      sourceSnapshot: UsageEventSourceSnapshot
      totalMatchedEvents: number
    }
  | {
      aggregateField: string
      availableAggregateFields: string[]
      input: UsageEventSearchInput
      mode: "grouped"
      overflowState: OverflowState
      rows: UsageEventGroupedRow[]
      sourceSnapshot: UsageEventSourceSnapshot
      totalGroupedRows: number
      totalMatchedEvents: number
    }

export type UsageEventParserOutput = ParsedUsageEventSearch & {
  liqeQuery: LiqeQuery | null
}
