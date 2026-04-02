import { USAGE_EVENT_PAGE_SIZE } from "@/server/usage-tracking/usage-event-config"
import { UsageEventSearchParser } from "@/server/usage-tracking/usage-event-search-parser"
import type {
  UsageEventQueryExpression,
  UsageEventQueryValue,
} from "@/server/usage-tracking/usage-event-query.types"
import type { WebhookUsageEvent } from "@/server/webhooks/webhook.types"

/**
 * Shared Liqe evaluator for webhook trigger rules.
 * It keeps parsing logic in one place and evaluates against an in-memory log snapshot.
 */
export class WebhookLiqeFilter {
  private readonly parser = new UsageEventSearchParser()

  matches(query: string, event: WebhookUsageEvent) {
    const normalizedQuery = query.trim()

    if (!normalizedQuery || normalizedQuery === "*") {
      return true
    }

    const parsed = this.parser.parse({
      trackableId: event.trackableId,
      query: normalizedQuery,
      aggregation: "none",
      aggregateField: null,
      sort: "lastOccurredAt",
      dir: "desc",
      from: null,
      to: null,
      cursor: null,
      pageSize: USAGE_EVENT_PAGE_SIZE,
    })

    return this.evaluateExpression(parsed.expression, event)
  }

  private evaluateExpression(
    expression: UsageEventQueryExpression,
    event: WebhookUsageEvent
  ): boolean {
    switch (expression.kind) {
      case "empty":
        return true
      case "logical":
        return expression.operator === "and"
          ? this.evaluateExpression(expression.left, event) &&
              this.evaluateExpression(expression.right, event)
          : this.evaluateExpression(expression.left, event) ||
              this.evaluateExpression(expression.right, event)
      case "not":
        return !this.evaluateExpression(expression.operand, event)
      case "comparison":
        return this.evaluateComparison(expression, event)
      case "range":
        return this.evaluateRange(expression, event)
      case "regex":
        return this.evaluateRegex(expression, event)
    }
  }

  private evaluateComparison(
    expression: Extract<UsageEventQueryExpression, { kind: "comparison" }>,
    event: WebhookUsageEvent
  ) {
    const candidate = this.readFieldValue(event, expression.fieldPath)

    if (Array.isArray(candidate)) {
      return candidate.some((value) =>
        this.compareScalar(value, expression.operator, expression.value)
      )
    }

    return this.compareScalar(candidate, expression.operator, expression.value)
  }

  private compareScalar(
    candidate: unknown,
    operator: Extract<
      UsageEventQueryExpression,
      { kind: "comparison" }
    >["operator"],
    expected: UsageEventQueryValue
  ) {
    if (operator === "match") {
      if (typeof candidate === "string" && typeof expected === "string") {
        return candidate.toLowerCase().includes(expected.toLowerCase())
      }

      return candidate === expected
    }

    if (operator === "eq") {
      return candidate === expected
    }

    const left = this.toComparableNumber(candidate)
    const right = this.toComparableNumber(expected)

    if (left === null || right === null) {
      return false
    }

    switch (operator) {
      case "gt":
        return left > right
      case "gte":
        return left >= right
      case "lt":
        return left < right
      case "lte":
        return left <= right
      default:
        return false
    }
  }

  private evaluateRange(
    expression: Extract<UsageEventQueryExpression, { kind: "range" }>,
    event: WebhookUsageEvent
  ) {
    const candidate = this.toComparableNumber(
      this.readFieldValue(event, expression.fieldPath)
    )

    if (candidate === null) {
      return false
    }

    const minPass = expression.minInclusive
      ? candidate >= expression.min
      : candidate > expression.min
    const maxPass = expression.maxInclusive
      ? candidate <= expression.max
      : candidate < expression.max

    return minPass && maxPass
  }

  private evaluateRegex(
    expression: Extract<UsageEventQueryExpression, { kind: "regex" }>,
    event: WebhookUsageEvent
  ) {
    const candidate = this.readFieldValue(event, expression.fieldPath)

    if (typeof candidate !== "string") {
      return false
    }

    try {
      return new RegExp(expression.value).test(candidate)
    } catch {
      return false
    }
  }

  private readFieldValue(event: WebhookUsageEvent, fieldPath: string[] | null) {
    if (!fieldPath || fieldPath.length === 0) {
      return event.payload
    }

    const [root, ...rest] = fieldPath

    if (root === "metadata") {
      return this.readPath(event.metadata, rest)
    }

    if (root === "payload") {
      return this.readPath(event.payload, rest)
    }

    if (root === "occurredAt") {
      return event.occurredAt.getTime()
    }

    return this.readPath(event.payload, fieldPath)
  }

  private readPath(source: unknown, path: string[]) {
    let current = source

    for (const segment of path) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return null
      }

      current = (current as Record<string, unknown>)[segment]
    }

    return current ?? null
  }

  private toComparableNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    return null
  }
}

export const webhookLiqeFilter = new WebhookLiqeFilter()
