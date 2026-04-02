import { TRPCError } from "@trpc/server"

import type {
  UsageEventCompiledExpression,
  UsageEventQueryExpression,
  UsageEventSqlField,
} from "@/server/usage-tracking/usage-event-query.types"

export class UsageEventSqlCompiler {
  compile(expression: UsageEventQueryExpression): UsageEventCompiledExpression {
    switch (expression.kind) {
      case "empty":
        return expression
      case "logical":
        return {
          kind: "logical",
          operator: expression.operator,
          left: this.compile(expression.left),
          right: this.compile(expression.right),
        }
      case "not":
        return {
          kind: "not",
          operand: this.compile(expression.operand),
        }
      case "comparison":
        return {
          kind: "comparison",
          field: this.resolveField(expression.fieldPath),
          operator: expression.operator,
          quoted: expression.quoted,
          value: expression.value,
        }
      case "range":
        return {
          kind: "range",
          field: this.resolveField(expression.fieldPath),
          max: expression.max,
          maxInclusive: expression.maxInclusive,
          min: expression.min,
          minInclusive: expression.minInclusive,
        }
      case "regex":
        return {
          kind: "regex",
          field: this.resolveField(expression.fieldPath),
          value: expression.value,
        }
      default:
        return assertNever(expression)
    }
  }

  private resolveField(fieldPath: string[] | null): UsageEventSqlField {
    if (!fieldPath || fieldPath.length === 0) {
      return { kind: "implicit" }
    }

    const [root, ...rest] = fieldPath

    if (root === "occurredAt") {
      if (rest.length > 0) {
        throw unsupportedFieldError(fieldPath)
      }

      return { kind: "occurredAt" }
    }

    if (root === "apiKey") {
      if (rest.length !== 1 || (rest[0] !== "id" && rest[0] !== "name")) {
        throw unsupportedFieldError(fieldPath)
      }

      return {
        kind: "apiKey",
        key: rest[0],
      }
    }

    if (root === "metadata") {
      return {
        kind: "metadata",
        path: rest,
      }
    }

    return {
      kind: "payload",
      path: fieldPath,
    }
  }
}

function unsupportedFieldError(fieldPath: string[]) {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: `Unsupported usage event field "${fieldPath.join(".")}".`,
  })
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}
