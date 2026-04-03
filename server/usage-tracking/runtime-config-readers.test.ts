import assert from "node:assert/strict"
import test from "node:test"

import { getUsageEventPageSize } from "@/server/usage-tracking/usage-event-config"
import { getInvalidApiKeyAttemptLimit } from "@/server/usage-tracking/usage-ingress-config"
import { getUsagePayloadSizeLimitBytes } from "@/server/usage-tracking/usage-request-security"

test("usage config readers use runtime config values", () => {
  assert.equal(getUsagePayloadSizeLimitBytes(), 65536)
  assert.equal(getInvalidApiKeyAttemptLimit(), 30)
  assert.equal(getUsageEventPageSize(), 101)
})
