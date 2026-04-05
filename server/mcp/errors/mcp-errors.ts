/**
 * MCP Error Types and Mapping
 *
 * Defines structured, agent-readable errors for all MCP failures.
 * Errors are explicit, stable, and never leak internal stack traces or
 * raw database details.
 */

import { ConflictError, LimitReachedError } from "@/server/errors"

/** Stable error codes used in all MCP error responses. */
export type McpErrorCode =
  | "UNAUTHORIZED"     // Token missing, invalid, expired, or revoked
  | "FORBIDDEN"        // Token valid but lacks permission
  | "NOT_FOUND"        // Resource does not exist or is out of scope
  | "VALIDATION_ERROR" // Payload failed deterministic validation
  | "SCOPE_ERROR"      // Token does not have capability for the requested tool/resource
  | "LIMIT_REACHED"    // A subscription quota or plan limit has been hit
  | "CONFLICT"         // A resource with the same identity already exists
  | "INTERNAL_ERROR"   // Unexpected server-side failure (safe message only)

/**
 * A single validation error pointing to a specific location in the payload.
 * Returned as part of VALIDATION_ERROR responses so agents can self-correct.
 */
export interface McpValidationError {
  /** JSON path to the invalid field, e.g. "fields[0].config.scale" */
  path: string
  /** Human-readable explanation of why the value is invalid */
  issue: string
  /** The value that was received (may be omitted for security) */
  received?: unknown
  /** Description of what was expected */
  expected: string
}

/** Thrown during token validation (before any tool logic runs). */
export class McpAuthError extends Error {
  readonly code: McpErrorCode

  constructor(code: McpErrorCode, message: string) {
    super(message)
    this.name = "McpAuthError"
    this.code = code
  }
}

/** Thrown during tool execution (after auth succeeds). */
export class McpToolError extends Error {
  readonly code: McpErrorCode
  readonly details: unknown

  constructor(code: McpErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = "McpToolError"
    this.code = code
    this.details = details
  }
}

/**
 * The structured error envelope returned to MCP clients.
 * Always safe to expose to agents — no stack traces or DB internals.
 */
interface McpErrorEnvelope {
  error: true
  code: McpErrorCode
  message: string
  details?: unknown
}

/**
 * Translates a known domain error into the equivalent McpToolError.
 * Uses instanceof checks — never inspects message content.
 * Forwards the error message 1:1 so callers see the original explanation.
 */
export function translateServiceError(error: Error): McpToolError {
  if (error instanceof LimitReachedError) {
    return new McpToolError("LIMIT_REACHED", error.message)
  }

  if (error instanceof ConflictError) {
    return new McpToolError("CONFLICT", error.message)
  }

  return new McpToolError("INTERNAL_ERROR", "An unexpected error occurred.")
}

/**
 * Maps any thrown error into a safe, structured MCP text content response.
 *
 * McpAuthError and McpToolError are mapped precisely.
 * All other errors become INTERNAL_ERROR with a generic message.
 */
export function buildMcpErrorContent(error: unknown): string {
  if (error instanceof McpAuthError) {
    const envelope: McpErrorEnvelope = {
      error: true,
      code: error.code,
      message: error.message,
    }
    return JSON.stringify(envelope)
  }

  if (error instanceof McpToolError) {
    const envelope: McpErrorEnvelope = {
      error: true,
      code: error.code,
      message: error.message,
      details: error.details,
    }
    return JSON.stringify(envelope)
  }

  // Unknown error — log the real cause server-side, but return a safe message
  const envelope: McpErrorEnvelope = {
    error: true,
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred. Please try again.",
  }
  return JSON.stringify(envelope)
}

/** Converts a Zod v4 error path array to a JSON-path string like "fields[0].config.scale". */
export function zodPathToString(path: (string | number)[]): string {
  return path.reduce<string>((acc, segment, i) => {
    if (typeof segment === "number") return `${acc}[${segment}]`
    return i === 0 ? segment : `${acc}.${segment}`
  }, "")
}
