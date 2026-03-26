import { TRPCError } from "@trpc/server"
import {
  type ExpressionToken,
  type FieldToken,
  type ImplicitFieldToken,
  type LiqeQuery,
  parse,
  test,
} from "liqe"

import type { UsageEventSearchInput } from "@/lib/usage-event-search"
import type {
  ParsedUsageEventSearch,
  UsageEventParserOutput,
  UsageEventQueryExpression,
  UsageEventQueryValue,
  UsageEventRecord,
} from "@/server/usage-tracking/usage-event-query.types"

export class UsageEventSearchParser {
  parse(input: UsageEventSearchInput): UsageEventParserOutput {
    const normalizedQuery = input.query.trim()
    const liqeQuery = normalizedQuery ? this.parseLiqeQuery(normalizedQuery) : null
    const expression = liqeQuery
      ? this.normalizeExpression(liqeQuery)
      : ({ kind: "empty" } satisfies UsageEventQueryExpression)

    const parsedSearch: ParsedUsageEventSearch = {
      aggregateField: input.aggregateField,
      expression,
      input,
      normalizedQuery,
      matchesRecord: (record) =>
        liqeQuery ? test(liqeQuery, buildSearchableSubject(record)) : true,
    }

    return {
      ...parsedSearch,
      liqeQuery,
    }
  }

  private normalizeExpression(query: LiqeQuery): UsageEventQueryExpression {
    switch (query.type) {
      case "EmptyExpression":
        return { kind: "empty" }
      case "LogicalExpression":
        return {
          kind: "logical",
          operator: query.operator.operator === "OR" ? "or" : "and",
          left: this.normalizeExpression(query.left),
          right: this.normalizeExpression(query.right),
        }
      case "ParenthesizedExpression":
        return this.normalizeExpression(query.expression)
      case "UnaryOperator":
        return {
          kind: "not",
          operand: this.normalizeExpression(query.operand),
        }
      case "Tag":
        return this.normalizeTagExpression(
          query.field,
          query.operator.operator,
          query.expression
        )
      default:
        return assertNever(query)
    }
  }

  private normalizeTagExpression(
    field: FieldToken | ImplicitFieldToken,
    operator: ":" | ":<" | ":<=" | ":=" | ":>" | ":>=",
    expression: ExpressionToken
  ): UsageEventQueryExpression {
    const fieldPath =
      field.type === "Field" ? (field.path ? [...field.path] : [field.name]) : null

    switch (expression.type) {
      case "EmptyExpression":
        return { kind: "empty" }
      case "LiteralExpression":
        return {
          kind: "comparison",
          fieldPath,
          operator: mapComparisonOperator(operator),
          value: expression.value as UsageEventQueryValue,
        }
      case "RangeExpression":
        return {
          kind: "range",
          fieldPath,
          min: expression.range.min,
          minInclusive: expression.range.minInclusive,
          max: expression.range.max,
          maxInclusive: expression.range.maxInclusive,
        }
      case "RegexExpression":
        return {
          kind: "regex",
          fieldPath,
          value: expression.value,
        }
      default:
        return assertNever(expression)
    }
  }

  private parseLiqeQuery(query: string) {
    try {
      return parse(query)
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error ? error.message : "Invalid liqe query.",
      })
    }
  }
}

function mapComparisonOperator(
  operator: ":" | ":<" | ":<=" | ":=" | ":>" | ":>="
) {
  switch (operator) {
    case ":":
    case ":=":
      return "eq"
    case ":>":
      return "gt"
    case ":>=":
      return "gte"
    case ":<":
      return "lt"
    case ":<=":
      return "lte"
    default:
      return assertNever(operator)
  }
}

function buildSearchableSubject(event: UsageEventRecord) {
  return {
    ...event.payload,
    occurredAt: event.occurredAt.toISOString(),
    apiKey: event.apiKey,
    metadata: parseMetadata(event.metadata),
  }
}

function parseMetadata(metadata: string | null) {
  if (!metadata) return null

  try {
    return JSON.parse(metadata) as unknown
  } catch {
    return metadata
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}
