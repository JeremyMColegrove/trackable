import assert from "node:assert/strict"
import test from "node:test"

import {
  LogCountWebhookTriggerRule,
  LogMatchWebhookTriggerRule,
  SurveyResponseReceivedWebhookTriggerRule,
} from "@/server/webhooks/webhook-trigger-rule"
import type {
  WebhookEventRepositoryContract,
  WebhookSurveyResponseEvent,
  WebhookUsageEvent,
  WebhookTriggerRuleRecord,
} from "@/server/webhooks/webhook.types"

class StubEventRepository implements WebhookEventRepositoryContract {
  public calls: Array<{
    filterQuery: string
    trackableId: string
    occurredAfter?: Date | null
    occurredBefore?: Date | null
  }> = []

  constructor(private readonly count: number) {}

  async countMatchingEvents(input: {
    filterQuery: string
    trackableId: string
    occurredAfter?: Date | null
    occurredBefore?: Date | null
  }) {
    this.calls.push(input)
    return this.count
  }
}

function buildEvent(
  overrides: Partial<WebhookUsageEvent> = {}
): WebhookUsageEvent {
  return {
    kind: "usage_event",
    id: "event-1",
    trackableId: "trackable-1",
    workspaceId: "workspace-1",
    occurredAt: new Date("2026-03-31T12:00:00.000Z"),
    payload: {
      level: "error",
      event: "signup_failed",
      route: "/signup",
    },
    metadata: {
      logId: "event-1",
      region: "us-east-1",
    },
    ...overrides,
  }
}

function buildRuleRecord(
  overrides: Partial<WebhookTriggerRuleRecord>
): WebhookTriggerRuleRecord {
  return {
    id: "rule-1",
    webhookId: "webhook-1",
    enabled: true,
    position: 0,
    config: {
      type: "log_match",
      liqeQuery: 'level:error AND event:"signup_failed"',
    },
    ...overrides,
  } as WebhookTriggerRuleRecord
}

function buildSurveyEvent(
  overrides: Partial<WebhookSurveyResponseEvent> = {}
): WebhookSurveyResponseEvent {
  return {
    kind: "survey_response",
    id: "submission-1",
    trackableId: "trackable-1",
    workspaceId: "workspace-1",
    occurredAt: new Date("2026-03-31T12:00:00.000Z"),
    payload: {
      source: "public_link",
      submitterLabel: "Anonymous",
      submissionSnapshot: {
        form: {
          id: "form-1",
          version: 1,
          title: "Survey",
          description: null,
          status: "published",
          submitLabel: "Submit",
          successMessage: null,
          fields: [],
        },
        answers: [],
      },
    },
    metadata: null,
    ...overrides,
  }
}

test("log_match trigger queries the database with the formatted event filter", async () => {
  const repository = new StubEventRepository(1)
  const rule = new LogMatchWebhookTriggerRule(buildRuleRecord({}))

  const match = await rule.matches(buildEvent(), {
    eventRepository: repository,
  })

  assert.deepEqual(match, {
    ruleId: "rule-1",
    reason: 'Log matched filter: level:error AND event:"signup_failed"',
  })
  assert.equal(
    repository.calls[0]?.filterQuery,
    '(level:error AND event:"signup_failed") AND metadata.logId:="event-1"'
  )
})

test("log_match trigger does not fire when the database query returns no rows", async () => {
  const repository = new StubEventRepository(0)
  const rule = new LogMatchWebhookTriggerRule(buildRuleRecord({}))

  const match = await rule.matches(buildEvent(), {
    eventRepository: repository,
  })

  assert.equal(match, null)
})

test("log_count_match trigger fires when the recent matching count reaches the threshold", async () => {
  const repository = new StubEventRepository(3)
  const rule = new LogCountWebhookTriggerRule(
    buildRuleRecord({
      config: {
        type: "log_count_match",
        liqeQuery: "level:error",
        windowMinutes: 10,
        matchCount: 3,
      },
    })
  )

  const match = await rule.matches(buildEvent(), {
    eventRepository: repository,
  })

  assert.deepEqual(match, {
    ruleId: "rule-1",
    reason: "3 matching logs found in the last 10 minutes",
  })
  assert.equal(repository.calls[0]?.filterQuery, "level:error")
  assert.ok(repository.calls[0]?.occurredAfter instanceof Date)
})

test("log_count_match trigger does not fire when the matching count stays below the threshold", async () => {
  const repository = new StubEventRepository(1)
  const rule = new LogCountWebhookTriggerRule(
    buildRuleRecord({
      config: {
        type: "log_count_match",
        liqeQuery: "level:error",
        windowMinutes: 10,
        matchCount: 2,
      },
    })
  )

  const match = await rule.matches(buildEvent(), {
    eventRepository: repository,
  })

  assert.equal(match, null)
})

test("survey_response_received trigger fires for survey submission events", async () => {
  const rule = new SurveyResponseReceivedWebhookTriggerRule(
    buildRuleRecord({
      config: {
        type: "survey_response_received",
      },
    })
  )

  const match = await rule.matches(buildSurveyEvent(), {
    eventRepository: new StubEventRepository(0),
  })

  assert.deepEqual(match, {
    ruleId: "rule-1",
    reason: "Survey response received.",
  })
})
