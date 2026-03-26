import type {
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
} from "@/lib/usage-event-search"
import { UsageEventFallbackEvaluator } from "@/server/usage-tracking/usage-event-fallback-evaluator"
import { UsageEventQueryPlanner } from "@/server/usage-tracking/usage-event-query-planner"
import { UsageEventResultBuilder } from "@/server/usage-tracking/usage-event-result-builder"
import {
  MAX_USAGE_EVENT_QUERY_ROWS,
  type UsageEventExecutionPlan,
  type UsageEventParserOutput,
  type UsageEventPipelineResult,
  type UsageEventSqlRepositoryContract,
} from "@/server/usage-tracking/usage-event-query.types"
import { collectUsageEventAggregateFields, groupUsageEventsByField } from "@/server/usage-tracking/usage-event-query.shared"
import { UsageEventSearchParser } from "@/server/usage-tracking/usage-event-search-parser"

export class UsageEventQueryPipeline {
  constructor(
    private readonly parser = new UsageEventSearchParser(),
    private readonly planner = new UsageEventQueryPlanner(),
    private readonly repository: UsageEventSqlRepositoryContract,
    private readonly fallbackEvaluator = new UsageEventFallbackEvaluator(),
    private readonly resultBuilder = new UsageEventResultBuilder(),
  ) {}

  async execute(
    input: UsageEventSearchInput,
    sourceSnapshot: UsageEventSourceSnapshot
  ): Promise<UsageEventPipelineResult> {
    const parsedSearch = this.parser.parse(input)
    const plan = this.planner.plan(parsedSearch)

    if (plan.evaluationMode === "sql_only") {
      return plan.executionMode === "grouped"
        ? this.executeSqlOnlyGroupedPlan(plan, sourceSnapshot)
        : this.executeSqlOnlyFlatPlan(plan, sourceSnapshot)
    }

    return plan.executionMode === "grouped"
      ? this.executeFallbackGroupedPlan(plan, parsedSearch, sourceSnapshot)
      : this.executeFallbackFlatPlan(plan, parsedSearch, sourceSnapshot)
  }

  private async executeSqlOnlyFlatPlan(
    plan: UsageEventExecutionPlan,
    sourceSnapshot: UsageEventSourceSnapshot
  ) {
    const [flatRows, totalMatchedEvents, aggregateFieldPayloads] =
      await Promise.all([
        this.repository.fetchFlatRows(plan, {
          limit: plan.input.limit,
        }),
        this.repository.countFlatRows(plan),
        this.repository.fetchAvailableAggregateFields(plan),
      ])

    return this.resultBuilder.build({
      availableAggregateFields: collectUsageEventAggregateFields(
        aggregateFieldPayloads.payloads
      ),
      input: plan.input,
      mode: "flat",
      overflowState: {
        maxLogsFound: totalMatchedEvents > MAX_USAGE_EVENT_QUERY_ROWS,
        partialResults: false,
      },
      rows: flatRows.rows,
      sourceSnapshot,
      totalMatchedEvents,
    })
  }

  private async executeSqlOnlyGroupedPlan(
    plan: UsageEventExecutionPlan,
    sourceSnapshot: UsageEventSourceSnapshot
  ) {
    const [groupedRows, aggregateFieldPayloads] = await Promise.all([
      this.repository.fetchGroupedRows(plan, {
        limit: plan.input.limit,
      }),
      this.repository.fetchAvailableAggregateFields(plan),
    ])

    return this.resultBuilder.build({
      aggregateField: plan.aggregateField!,
      availableAggregateFields: collectUsageEventAggregateFields(
        aggregateFieldPayloads.payloads
      ),
      input: plan.input,
      mode: "grouped",
      overflowState: {
        maxLogsFound: groupedRows.totalGroupedRows > MAX_USAGE_EVENT_QUERY_ROWS,
        partialResults: false,
      },
      rows: groupedRows.rows,
      sourceSnapshot,
      totalGroupedRows: groupedRows.totalGroupedRows,
      totalMatchedEvents: groupedRows.totalMatchedEvents,
    })
  }

  private async executeFallbackFlatPlan(
    plan: UsageEventExecutionPlan,
    parsedSearch: UsageEventParserOutput,
    sourceSnapshot: UsageEventSourceSnapshot
  ) {
    const sqlRows = await this.repository.fetchFlatRows(plan)
    const filteredRows = this.fallbackEvaluator.evaluate(sqlRows.rows, parsedSearch)

    return this.resultBuilder.build({
      availableAggregateFields: collectUsageEventAggregateFields(
        filteredRows.map((row) => row.payload)
      ),
      input: plan.input,
      mode: "flat",
      overflowState: {
        maxLogsFound: filteredRows.length > MAX_USAGE_EVENT_QUERY_ROWS,
        partialResults: true,
      },
      rows: filteredRows,
      sourceSnapshot,
      totalMatchedEvents: filteredRows.length,
    })
  }

  private async executeFallbackGroupedPlan(
    plan: UsageEventExecutionPlan,
    parsedSearch: UsageEventParserOutput,
    sourceSnapshot: UsageEventSourceSnapshot
  ) {
    const sqlRows = await this.repository.fetchFlatRows(plan)
    const filteredRows = this.fallbackEvaluator.evaluate(sqlRows.rows, parsedSearch)
    const groupedRows = groupUsageEventsByField(filteredRows, plan.aggregateField!)

    return this.resultBuilder.build({
      aggregateField: plan.aggregateField!,
      availableAggregateFields: collectUsageEventAggregateFields(
        filteredRows.map((row) => row.payload)
      ),
      input: plan.input,
      mode: "grouped",
      overflowState: {
        maxLogsFound: groupedRows.length > MAX_USAGE_EVENT_QUERY_ROWS,
        partialResults: true,
      },
      rows: groupedRows,
      sourceSnapshot,
      totalGroupedRows: groupedRows.length,
      totalMatchedEvents: filteredRows.length,
    })
  }
}
