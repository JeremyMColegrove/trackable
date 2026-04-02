import assert from "node:assert/strict"
import test from "node:test"

import { WebhookTriggerSearchBuilder } from "@/server/webhooks/webhook-trigger-search"

test("buildLogMatchQuery appends an exact metadata.logId lookup to the liqe query", () => {
  const builder = new WebhookTriggerSearchBuilder()

  assert.equal(
    builder.buildLogMatchQuery({
      eventId: "log-123",
      liqeQuery: 'level:error OR event:"signup_failed"',
    }),
    '(level:error OR event:"signup_failed") AND metadata.logId:="log-123"'
  )
})

test('buildLogMatchQuery collapses "*" into the event lookup only', () => {
  const builder = new WebhookTriggerSearchBuilder()

  assert.equal(
    builder.buildLogMatchQuery({
      eventId: "log-123",
      liqeQuery: " * ",
    }),
    'metadata.logId:="log-123"'
  )
})

test("buildLogMatchQuery escapes quotes in the log id", () => {
  const builder = new WebhookTriggerSearchBuilder()

  assert.equal(
    builder.buildLogMatchQuery({
      eventId: 'log-"123"',
      liqeQuery: "level:error",
    }),
    '(level:error) AND metadata.logId:="log-\\"123\\""'
  )
})

test("buildLogCountQuery trims the liqe query and falls back to wildcard", () => {
  const builder = new WebhookTriggerSearchBuilder()

  assert.equal(
    builder.buildLogCountQuery({
      liqeQuery: "  level:error  ",
    }),
    "level:error"
  )
  assert.equal(
    builder.buildLogCountQuery({
      liqeQuery: "   ",
    }),
    "*"
  )
})
