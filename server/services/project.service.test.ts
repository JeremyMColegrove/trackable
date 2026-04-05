import assert from "node:assert/strict"
import test from "node:test"

import { getDefaultTrackableSettings } from "@/server/services/project-settings"

test("api ingestion trackables default retention to the workspace plan maximum", () => {
  assert.deepEqual(
    getDefaultTrackableSettings({
      kind: "api_ingestion",
      maxLogRetentionDays: 3,
    }),
    {
      apiLogRetentionDays: 3,
    }
  )

  assert.deepEqual(
    getDefaultTrackableSettings({
      kind: "api_ingestion",
      maxLogRetentionDays: 90,
    }),
    {
      apiLogRetentionDays: 90,
    }
  )
})

test("api ingestion trackables default retention to forever when the plan is unlimited", () => {
  assert.deepEqual(
    getDefaultTrackableSettings({
      kind: "api_ingestion",
      maxLogRetentionDays: null,
    }),
    {
      apiLogRetentionDays: null,
    }
  )
})

test("survey trackables do not receive API log retention settings", () => {
  assert.equal(
    getDefaultTrackableSettings({
      kind: "survey",
      maxLogRetentionDays: 3,
    }),
    undefined
  )
})
