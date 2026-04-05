import type { UsageEventTableResult } from "@/lib/usage-event-search"
import {
  buildFlatUsageEventRow,
  buildGroupedUsageEventRow,
  buildUsageEventColumns,
} from "@/server/usage-tracking/usage-event-query.shared"
import type {
  UsageEventPipelineResult,
  UsageEventResultBuilderInput,
} from "@/server/usage-tracking/usage-event-query.types"

export class UsageEventResultBuilder {
  build(input: UsageEventResultBuilderInput): UsageEventPipelineResult {
    if (input.mode === "flat") {
      const rows = input.rows.map((row) =>
        buildFlatUsageEventRow(row, input.totalMatchedEvents)
      )

      return {
        availableAggregateFields: input.availableAggregateFields,
        columns: buildUsageEventColumns(input.input.aggregation, null),
        hasMore: input.hasMore,
        nextCursor: input.nextCursor,
        rows,
        sourceSnapshot: input.sourceSnapshot,
        totalGroupedRows: input.totalMatchedEvents,
        totalMatchedEvents: input.totalMatchedEvents,
      } satisfies UsageEventPipelineResult
    }

    const rows = input.rows.map((row) =>
      buildGroupedUsageEventRow(
        row,
        input.aggregateField,
        input.totalMatchedEvents
      )
    )

    return {
      availableAggregateFields: input.availableAggregateFields,
      columns: buildUsageEventColumns(
        input.input.aggregation,
        input.aggregateField
      ),
      hasMore: input.hasMore,
      nextCursor: input.nextCursor,
      rows,
      sourceSnapshot: input.sourceSnapshot,
      totalGroupedRows: input.totalGroupedRows,
      totalMatchedEvents: input.totalMatchedEvents,
    } satisfies UsageEventPipelineResult
  }
}
