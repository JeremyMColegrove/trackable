import assert from "node:assert/strict"
import test from "node:test"

import {
  assertSafeWebhookTargetUrl,
  validateWebhookTargetUrl,
} from "@/server/webhooks/webhook-url-security"

test("validateWebhookTargetUrl accepts standard HTTPS webhook targets", () => {
  assert.doesNotThrow(() =>
    validateWebhookTargetUrl("https://example.com/hooks/alerts")
  )
})

test("validateWebhookTargetUrl rejects non-HTTPS targets", () => {
  assert.throws(
    () => validateWebhookTargetUrl("http://example.com/hooks/alerts"),
    /must use HTTPS/
  )
})

test("validateWebhookTargetUrl rejects localhost and private IP literals", () => {
  for (const value of [
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.0.0.5/hook",
    "https://192.168.1.10/hook",
    "https://[::1]/hook",
  ]) {
    assert.throws(
      () => validateWebhookTargetUrl(value),
      /cannot use localhost or other local network addresses/
    )
  }
})

test("validateWebhookTargetUrl rejects embedded credentials", () => {
  assert.throws(
    () => validateWebhookTargetUrl("https://user:pass@example.com/hook"),
    /must not include embedded credentials/
  )
})

test("assertSafeWebhookTargetUrl rejects DNS names resolving to private addresses", async () => {
  await assert.rejects(
    () =>
      assertSafeWebhookTargetUrl("https://internal.example/hook", async () => [
        { address: "10.0.0.42", family: 4 },
      ]),
    /cannot resolve to localhost or a private network address/
  )
})

test("assertSafeWebhookTargetUrl allows DNS names resolving to public addresses", async () => {
  await assert.doesNotReject(() =>
    assertSafeWebhookTargetUrl("https://hooks.example/hook", async () => [
      { address: "93.184.216.34", family: 4 },
    ])
  )
})
