import type { LiqeQuery } from "liqe"

import type { UsageEventMetadata } from "@/db/schema/types"
import type {
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
  UsageEventTableApiKey,
  UsageEventTableResult,
} from "@/lib/usage-event-search"

export type UsageEventRecord = {
  id: string
  occurredAt: Date
  payload: Record<string, unknown>
  metadata: UsageEventMetadata | null
  apiKey: UsageEventTableApiKey
}

export type UsageEventSortDescriptor = Pick<
  UsageEventSearchInput,
  "dir" | "sort"
>

export type UsageEventQueryValue = boolean | number | null | string

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
      operator: "match" | "eq" | "gt" | "gte" | "lt" | "lte"
      quoted: boolean
      value: UsageEventQueryValue
    }
  | {
      kind: "range"
      fieldPath: string[] | null
      max: number
      maxInclusive: boolean
      min: number
      minInclusive: boolean
    }
  | {
      kind: "regex"
      fieldPath: string[] | null
      value: string
    }

export type UsageEventSqlField =
  | { kind: "implicit" }
  | { kind: "occurredAt" }
  | { kind: "apiKey"; key: "id" | "name" }
  | { kind: "metadata"; path: string[] }
  | { kind: "payload"; path: string[] }

export type UsageEventCompiledExpression =
  | { kind: "empty" }
  | {
      kind: "logical"
      operator: "and" | "or"
      left: UsageEventCompiledExpression
      right: UsageEventCompiledExpression
    }
  | {
      kind: "not"
      operand: UsageEventCompiledExpression
    }
  | {
      kind: "comparison"
      field: UsageEventSqlField
      operator: "match" | "eq" | "gt" | "gte" | "lt" | "lte"
      quoted: boolean
      value: UsageEventQueryValue
    }
  | {
      kind: "range"
      field: UsageEventSqlField
      max: number
      maxInclusive: boolean
      min: number
      minInclusive: boolean
    }
  | {
      kind: "regex"
      field: UsageEventSqlField
      value: string
    }

export type ParsedUsageEventSearch = {
  aggregateField: string | null
  expression: UsageEventQueryExpression
  input: UsageEventSearchInput
  liqeQuery: LiqeQuery | null
  normalizedQuery: string
}

export type QueryExecutionMode = "flat" | "grouped"

export type UsageEventExecutionPlan = {
  aggregateField: string | null
  executionMode: QueryExecutionMode
  filterExpression: UsageEventCompiledExpression
  input: UsageEventSearchInput
}

export type UsageEventFlatQueryResult = {
  hasMore: boolean
  nextCursor: string | null
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

export type UsageEventGroupedRowsPage = {
  hasMore: boolean
  nextCursor: string | null
  rows: UsageEventGroupedRow[]
}

export type UsageEventGroupedTotals = {
  totalGroupedRows: number
  totalMatchedEvents: number
}

export type UsageEventAvailableFieldsQueryResult = {
  fields: string[]
}

export type UsageEventSqlRepositoryContract = {
  countFlatRows(plan: UsageEventExecutionPlan): Promise<number>
  fetchAvailableAggregateFields(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventAvailableFieldsQueryResult>
  fetchFlatRows(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventFlatQueryResult>
  fetchGroupedRowsPage(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventGroupedRowsPage>
  fetchGroupedTotals(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventGroupedTotals>
}

export type UsageEventPipelineResult = UsageEventTableResult

export type UsageEventResultBuilderInput =
  | {
      availableAggregateFields: string[]
      hasMore: boolean
      input: UsageEventSearchInput
      mode: "flat"
      nextCursor: string | null
      rows: UsageEventRecord[]
      sourceSnapshot: UsageEventSourceSnapshot
      totalMatchedEvents: number
    }
  | {
      aggregateField: string
      availableAggregateFields: string[]
      hasMore: boolean
      input: UsageEventSearchInput
      mode: "grouped"
      nextCursor: string | null
      rows: UsageEventGroupedRow[]
      sourceSnapshot: UsageEventSourceSnapshot
      totalGroupedRows: number
      totalMatchedEvents: number
    }

export type UsageEventParserOutput = ParsedUsageEventSearch
