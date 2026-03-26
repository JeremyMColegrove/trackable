import type {
  ParsedUsageEventSearch,
  UsageEventExecutionPlan,
  UsageEventQueryExpression,
  UsageEventSqlField,
  UsageEventSqlPredicate,
} from "@/server/usage-tracking/usage-event-query.types"

const SQL_SAFE_FIELD_NAME = /^[A-Za-z0-9_]+$/

export class UsageEventQueryPlanner {
  plan(parsedSearch: ParsedUsageEventSearch): UsageEventExecutionPlan {
    const sqlPredicates = this.collectSqlPredicates(parsedSearch.expression)
    const evaluationMode =
      sqlPredicates.fallbackRequired || parsedSearch.normalizedQuery.length > 0
        ? sqlPredicates.fallbackRequired
          ? "sql_plus_fallback"
          : "sql_only"
        : "sql_only"

    return {
      aggregateField: parsedSearch.aggregateField,
      evaluationMode,
      executionMode:
        parsedSearch.input.aggregation === "payload_field" &&
        Boolean(parsedSearch.aggregateField)
          ? "grouped"
          : "flat",
      input: parsedSearch.input,
      sqlPredicates: sqlPredicates.predicates,
    }
  }

  private collectSqlPredicates(expression: UsageEventQueryExpression): {
    fallbackRequired: boolean
    predicates: UsageEventSqlPredicate[]
  } {
    const topLevelTerms = flattenAndTerms(expression)
    const predicates: UsageEventSqlPredicate[] = []
    let fallbackRequired = false

    for (const term of topLevelTerms) {
      const predicate = this.toSqlPredicate(term)

      if (predicate) {
        predicates.push(predicate)
        continue
      }

      if (term.kind !== "empty") {
        fallbackRequired = true
      }
    }

    return {
      fallbackRequired,
      predicates,
    }
  }

  private toSqlPredicate(
    expression: UsageEventQueryExpression
  ): UsageEventSqlPredicate | null {
    if (expression.kind !== "comparison" || expression.operator !== "eq") {
      return null
    }

    const field = this.resolveSqlField(expression.fieldPath)

    if (!field) {
      return null
    }

    return {
      field,
      operator: "eq",
      value: expression.value,
    }
  }

  private resolveSqlField(fieldPath: string[] | null): UsageEventSqlField | null {
    if (!fieldPath || fieldPath.length === 0) {
      return null
    }

    if (
      fieldPath.length === 2 &&
      fieldPath[0] === "apiKey" &&
      (fieldPath[1] === "id" || fieldPath[1] === "name")
    ) {
      return {
        kind: "apiKey",
        key: fieldPath[1],
      }
    }

    if (
      fieldPath.length === 1 &&
      SQL_SAFE_FIELD_NAME.test(fieldPath[0] ?? "")
    ) {
      return {
        kind: "payload",
        key: fieldPath[0]!,
      }
    }

    return null
  }
}

function flattenAndTerms(
  expression: UsageEventQueryExpression
): UsageEventQueryExpression[] {
  if (expression.kind === "logical" && expression.operator === "and") {
    return [
      ...flattenAndTerms(expression.left),
      ...flattenAndTerms(expression.right),
    ]
  }

  return [expression]
}
