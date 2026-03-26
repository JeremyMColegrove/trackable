import type { UsageEventTableResult } from "@/lib/usage-event-search"
import {
  buildFlatUsageEventRow,
  buildGroupedUsageEventRow,
  buildUsageEventColumns,
  buildUsageEventRowComparator,
} from "@/server/usage-tracking/usage-event-query.shared"
import type {
  UsageEventPipelineResult,
  UsageEventResultBuilderInput,
} from "@/server/usage-tracking/usage-event-query.types"

export class UsageEventResultBuilder {
  build(input: UsageEventResultBuilderInput): UsageEventPipelineResult {
    if (input.mode === "flat") {
      const rows = input.rows
        .map((row) => buildFlatUsageEventRow(row, input.totalMatchedEvents))
        .sort(buildUsageEventRowComparator(input.input))

      return {
        availableAggregateFields: input.availableAggregateFields,
        columns: buildUsageEventColumns(input.input.aggregation, null),
        maxLogsFound: input.overflowState.maxLogsFound,
        overflowState: input.overflowState,
        partialResults: input.overflowState.partialResults,
        rows: rows.slice(0, input.input.limit),
        sourceSnapshot: input.sourceSnapshot,
        totalGroupedRows: input.totalMatchedEvents,
        totalMatchedEvents: input.totalMatchedEvents,
      } satisfies UsageEventPipelineResult
    }

    const rows = input.rows
      .map((row) =>
        buildGroupedUsageEventRow(
          row,
          input.aggregateField,
          input.totalMatchedEvents
        )
      )
      .sort(buildUsageEventRowComparator(input.input))

    return {
      availableAggregateFields: input.availableAggregateFields,
      columns: buildUsageEventColumns(input.input.aggregation, input.aggregateField),
      maxLogsFound: input.overflowState.maxLogsFound,
      overflowState: input.overflowState,
      partialResults: input.overflowState.partialResults,
      rows: rows.slice(0, input.input.limit),
      sourceSnapshot: input.sourceSnapshot,
      totalGroupedRows: input.totalGroupedRows,
      totalMatchedEvents: input.totalMatchedEvents,
    } satisfies UsageEventPipelineResult
  }
}
