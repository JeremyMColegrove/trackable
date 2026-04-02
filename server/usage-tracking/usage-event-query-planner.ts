import { UsageEventSqlCompiler } from "@/server/usage-tracking/usage-event-sql-compiler"
import type {
  ParsedUsageEventSearch,
  UsageEventExecutionPlan,
} from "@/server/usage-tracking/usage-event-query.types"

export class UsageEventQueryPlanner {
  constructor(private readonly compiler = new UsageEventSqlCompiler()) {}

  plan(parsedSearch: ParsedUsageEventSearch): UsageEventExecutionPlan {
    return {
      aggregateField: parsedSearch.aggregateField,
      executionMode:
        parsedSearch.input.aggregation === "payload_field" &&
        Boolean(parsedSearch.aggregateField)
          ? "grouped"
          : "flat",
      filterExpression: this.compiler.compile(parsedSearch.expression),
      input: parsedSearch.input,
    }
  }
}
