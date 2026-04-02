import type {
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
} from "@/lib/usage-event-search"
import { UsageEventQueryPlanner } from "@/server/usage-tracking/usage-event-query-planner"
import { UsageEventResultBuilder } from "@/server/usage-tracking/usage-event-result-builder"
import {
  type UsageEventPipelineResult,
  type UsageEventSqlRepositoryContract,
} from "@/server/usage-tracking/usage-event-query.types"
import { UsageEventSearchParser } from "@/server/usage-tracking/usage-event-search-parser"

export class UsageEventQueryPipeline {
  constructor(
    private readonly parser = new UsageEventSearchParser(),
    private readonly planner = new UsageEventQueryPlanner(),
    private readonly repository: UsageEventSqlRepositoryContract,
    private readonly resultBuilder = new UsageEventResultBuilder()
  ) {}

  async execute(
    input: UsageEventSearchInput,
    sourceSnapshot: UsageEventSourceSnapshot
  ): Promise<UsageEventPipelineResult> {
    const parsedSearch = this.parser.parse(input)
    const plan = this.planner.plan(parsedSearch)

    return plan.executionMode === "grouped"
      ? this.executeGroupedPlan(plan, sourceSnapshot)
      : this.executeFlatPlan(plan, sourceSnapshot)
  }

  private async executeFlatPlan(
    plan: ReturnType<UsageEventQueryPlanner["plan"]>,
    sourceSnapshot: UsageEventSourceSnapshot
  ) {
    const isFirstPage = !plan.input.cursor
    const flatRowsPromise = this.repository.fetchFlatRows(plan)
    const totalMatchedEventsPromise = isFirstPage
      ? this.repository.countFlatRows(plan)
      : Promise.resolve(0)
    const availableAggregateFieldsPromise = isFirstPage
      ? this.repository.fetchAvailableAggregateFields(plan)
      : Promise.resolve({ fields: [] })
    const [flatRows, totalMatchedEvents, availableAggregateFields] =
      await Promise.all([
        flatRowsPromise,
        totalMatchedEventsPromise,
        availableAggregateFieldsPromise,
      ])

    return this.resultBuilder.build({
      availableAggregateFields: availableAggregateFields.fields,
      hasMore: flatRows.hasMore,
      input: plan.input,
      mode: "flat",
      nextCursor: flatRows.nextCursor,
      rows: flatRows.rows,
      sourceSnapshot,
      totalMatchedEvents,
    })
  }

  private async executeGroupedPlan(
    plan: ReturnType<UsageEventQueryPlanner["plan"]>,
    sourceSnapshot: UsageEventSourceSnapshot
  ) {
    const isFirstPage = !plan.input.cursor
    const groupedRowsPromise = this.repository.fetchGroupedRowsPage(plan)
    const availableAggregateFieldsPromise = isFirstPage
      ? this.repository.fetchAvailableAggregateFields(plan)
      : Promise.resolve({ fields: [] })
    const groupedTotalsPromise = isFirstPage
      ? this.repository.fetchGroupedTotals(plan)
      : Promise.resolve({
          totalGroupedRows: 0,
          totalMatchedEvents: 0,
        })
    const [groupedRows, availableAggregateFields, groupedTotals] =
      await Promise.all([
        groupedRowsPromise,
        availableAggregateFieldsPromise,
        groupedTotalsPromise,
      ])

    return this.resultBuilder.build({
      aggregateField: plan.aggregateField!,
      availableAggregateFields: availableAggregateFields.fields,
      hasMore: groupedRows.hasMore,
      input: plan.input,
      mode: "grouped",
      nextCursor: groupedRows.nextCursor,
      rows: groupedRows.rows,
      sourceSnapshot,
      totalGroupedRows: groupedTotals.totalGroupedRows,
      totalMatchedEvents: groupedTotals.totalMatchedEvents,
    })
  }
}
