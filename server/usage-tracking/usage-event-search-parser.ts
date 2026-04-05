import { TRPCError } from "@trpc/server"
import {
  type ExpressionToken,
  type FieldToken,
  type ImplicitFieldToken,
  type LiqeQuery,
  parse,
} from "liqe"

import type { UsageEventSearchInput } from "@/lib/usage-event-search"
import type {
  UsageEventParserOutput,
  UsageEventQueryExpression,
  UsageEventQueryValue,
} from "@/server/usage-tracking/usage-event-query.types"

export class UsageEventSearchParser {
  parse(input: UsageEventSearchInput): UsageEventParserOutput {
    const normalizedQuery = input.query.trim()
    const liqeQuery = normalizedQuery
      ? this.parseLiqeQuery(normalizedQuery)
      : null
    const expression = liqeQuery
      ? this.normalizeExpression(liqeQuery)
      : ({ kind: "empty" } satisfies UsageEventQueryExpression)

    return {
      aggregateField: input.aggregateField,
      expression,
      input,
      liqeQuery,
      normalizedQuery,
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
          getTagOperator(query),
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
      field.type === "Field"
        ? field.path
          ? [...field.path]
          : [field.name]
        : null

    switch (expression.type) {
      case "EmptyExpression":
        return { kind: "empty" }
      case "LiteralExpression":
        return {
          kind: "comparison",
          fieldPath,
          operator: mapComparisonOperator(operator),
          quoted: expression.quoted,
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
      const normalizedRegexQuery = stripRegexNoOpFlags(query)

      if (normalizedRegexQuery !== query) {
        try {
          return parse(normalizedRegexQuery)
        } catch {
          // Fall through to the original error for a stable user-facing message.
        }
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "Invalid liqe query.",
      })
    }
  }
}

function mapComparisonOperator(
  operator: ":" | ":<" | ":<=" | ":=" | ":>" | ":>="
) {
  switch (operator) {
    case ":":
      return "match"
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

function getTagOperator(query: Extract<LiqeQuery, { type: "Tag" }>) {
  return query.operator?.operator ?? ":"
}

function stripRegexNoOpFlags(query: string) {
  let result = ""
  let index = 0
  let activeQuote: "'" | '"' | null = null

  while (index < query.length) {
    const character = query[index]

    if (activeQuote) {
      result += character

      if (character === "\\" && index + 1 < query.length) {
        result += query[index + 1]
        index += 2
        continue
      }

      if (character === activeQuote) {
        activeQuote = null
      }

      index += 1
      continue
    }

    if (character === "'" || character === '"') {
      activeQuote = character
      result += character
      index += 1
      continue
    }

    if (character !== "/") {
      result += character
      index += 1
      continue
    }

    let closingSlashIndex = index + 1
    let escaped = false

    while (closingSlashIndex < query.length) {
      const regexCharacter = query[closingSlashIndex]

      if (escaped) {
        escaped = false
        closingSlashIndex += 1
        continue
      }

      if (regexCharacter === "\\") {
        escaped = true
        closingSlashIndex += 1
        continue
      }

      if (regexCharacter === "/") {
        break
      }

      closingSlashIndex += 1
    }

    if (closingSlashIndex >= query.length || query[closingSlashIndex] !== "/") {
      result += character
      index += 1
      continue
    }

    let flagIndex = closingSlashIndex + 1

    while (flagIndex < query.length && /[a-z]/i.test(query[flagIndex] ?? "")) {
      flagIndex += 1
    }

    const flags = query.slice(closingSlashIndex + 1, flagIndex)
    const normalizedFlags = flags.replaceAll("o", "").replaceAll("O", "")

    result += query.slice(index, closingSlashIndex + 1) + normalizedFlags
    index = flagIndex
  }

  return result
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}
