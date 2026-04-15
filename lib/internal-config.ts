/**
 * Internal server configuration.
 * These values are not exposed to end users via config.json.
 * Edit this file directly to adjust defaults.
 */

/** Maximum invalid API key attempts per IP per minute before rate-limiting kicks in. */
export const INVALID_API_KEY_RATE_LIMIT_PER_MINUTE = 30

/** Maximum HTTP body size in bytes at the API gateway level (DoS protection). */
export const USAGE_GATEWAY_MAX_BODY_BYTES = 1 * 1024 * 1024 // 1 MB

/** Number of log entries fetched per page in the log viewer. */
export const USAGE_PAGE_SIZE = 100
