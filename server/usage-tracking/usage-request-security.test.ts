import assert from "node:assert/strict"
import test from "node:test"

import {
  buildUsageRequestMetadata,
  getUsageClientIdentity,
  getClientIp,
  parseUsagePayload,
} from "@/server/usage-tracking/usage-request-security"

test("parseUsagePayload requires JSON content type", async () => {
  const request = new Request("https://example.com/api/usage", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
    },
    body: "{}",
  })

  await assert.rejects(
    () => parseUsagePayload(request),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'Content-Type must be "application/json".'
  )
})

test("parseUsagePayload rejects oversized request bodies", async () => {
  const request = new Request("https://example.com/api/usage", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: "x".repeat(128),
    }),
  })

  await assert.rejects(
    () => parseUsagePayload(request, 32),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Request body must not exceed 32 bytes."
  )
})

test("buildUsageRequestMetadata stores a single normalized client ip", () => {
  const request = new Request("https://example.com/api/usage", {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "user-agent": "trackables-test",
      "x-forwarded-for": "203.0.113.5, 198.51.100.9",
    },
  })

  assert.deepEqual(buildUsageRequestMetadata(request), {
    contentType: "application/json; charset=utf-8",
    userAgent: "trackables-test",
    clientIp: "203.0.113.5",
  })
})

test("client identity falls back to a user-agent fingerprint", () => {
  const headers = new Headers({
    "user-agent": "trackables-test",
    "x-forwarded-for": "not-an-ip",
  })

  assert.equal(getClientIp(headers), null)
  assert.match(getUsageClientIdentity(headers), /^ua:[0-9a-f]{12}$/)
})
