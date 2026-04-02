import assert from "node:assert/strict"
import test from "node:test"

import { normalizeUsageEventMetadata } from "@/server/usage-tracking/usage-event-metadata"

test("normalizeUsageEventMetadata keeps structured metadata objects", () => {
  assert.deepEqual(normalizeUsageEventMetadata({ route: "/billing" }), {
    route: "/billing",
  })
})

test("normalizeUsageEventMetadata backfills historical JSON text metadata", () => {
  assert.deepEqual(
    normalizeUsageEventMetadata('{"route":"/billing","nested":{"ok":true}}'),
    {
      route: "/billing",
      nested: { ok: true },
    }
  )
})

test("normalizeUsageEventMetadata rejects invalid or non-object metadata", () => {
  assert.equal(normalizeUsageEventMetadata("[1,2,3]"), null)
  assert.equal(normalizeUsageEventMetadata("not-json"), null)
  assert.equal(normalizeUsageEventMetadata(null), null)
})
