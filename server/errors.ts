/**
 * Domain error classes for server-side business logic.
 *
 * These are thrown from service layer code and translated at the boundary
 * (tRPC middleware for HTTP callers, translateServiceError for MCP callers).
 */

/** Thrown when a subscription quota or plan limit has been reached. */
export class LimitReachedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LimitReachedError"
  }
}

/** Thrown when a resource with the same identity already exists. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConflictError"
  }
}
