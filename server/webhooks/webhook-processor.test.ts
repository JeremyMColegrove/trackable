import assert from "node:assert/strict"
import test from "node:test"

import { WebhookProcessor } from "@/server/webhooks/webhook-processor"
import type {
  WebhookExecutionResult,
  WebhookSurveyResponseEvent,
  WebhookUsageEvent,
  WebhookQueueJobData,
} from "@/server/webhooks/webhook.types"

class StubRepository {
  public queries: Array<{
    filterQuery: string
    trackableId: string
    occurredAfter?: Date | null
    occurredBefore?: Date | null
  }> = []

  constructor(
    private readonly usageEvent: WebhookUsageEvent | null,
    private readonly surveyEvent: WebhookSurveyResponseEvent | null,
    private readonly count: number
  ) {}

  async getUsageEventById() {
    return this.usageEvent
  }

  async getSurveyResponseEventById() {
    return this.surveyEvent
  }

  async countMatchingEvents(input: {
    filterQuery: string
    trackableId: string
    occurredAfter?: Date | null
    occurredBefore?: Date | null
  }) {
    this.queries.push(input)
    return this.count
  }
}

class RecordingDispatchService {
  public calls: Array<Record<string, unknown>> = []

  constructor(
    private readonly result: WebhookExecutionResult = {
      ok: true,
      response: { status: 204, body: "" },
      errorMessage: null,
      statusCode: 204,
      failureKind: null,
    }
  ) {}

  async dispatch(input: Record<string, unknown>) {
    this.calls.push(input)
    return this.result
  }
}

function buildEvent(): WebhookUsageEvent {
  return {
    kind: "usage_event",
    id: "event-1",
    trackableId: "trackable-1",
    workspaceId: "workspace-1",
    occurredAt: new Date("2026-03-31T12:00:00.000Z"),
    payload: {
      level: "error",
      event: "signup_failed",
    },
    metadata: {
      logId: "event-1",
      region: "us-east-1",
    },
  }
}

function buildSurveyEvent(): WebhookSurveyResponseEvent {
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
  }
}

function buildJobData(
  overrides: Partial<WebhookQueueJobData> = {}
): WebhookQueueJobData {
  return {
    event: {
      kind: "usage_event",
      id: "event-1",
      occurredAt: "2026-03-31T12:00:00.000Z",
      trackableId: "trackable-1",
      workspaceId: "workspace-1",
    },
    webhook: {
      id: "webhook-1",
      workspaceId: "workspace-1",
      name: "Error webhook",
      provider: "generic",
      enabled: true,
      config: {
        provider: "generic",
        url: "https://example.com/hook",
        headers: {},
      },
      triggerRules: [],
    },
    triggerRule: {
      id: "rule-1",
      webhookId: "webhook-1",
      enabled: true,
      position: 0,
      config: {
        type: "log_match",
        liqeQuery: "level:error",
      },
    },
    ...overrides,
  }
}

test("processor dispatches when the queued log match query returns results", async () => {
  const repository = new StubRepository(buildEvent(), null, 1)
  const dispatchService = new RecordingDispatchService()
  const processor = new WebhookProcessor(
    repository as never,
    dispatchService as never
  )

  const result = await processor.process({
    id: "job-1",
    name: "deliver-webhook-notification",
    data: buildJobData(),
  })

  assert.deepEqual(result, {
    delivered: true,
    eventId: "event-1",
    failureKind: null,
    logId: "event-1",
    reason: "delivered",
    statusCode: 204,
  })
  assert.equal(dispatchService.calls.length, 1)
  assert.equal(
    repository.queries[0]?.filterQuery,
    '(level:error) AND metadata.logId:="event-1"'
  )
})

test("processor skips delivery when the queued query has no matches", async () => {
  const repository = new StubRepository(buildEvent(), null, 0)
  const dispatchService = new RecordingDispatchService()
  const processor = new WebhookProcessor(
    repository as never,
    dispatchService as never
  )

  const result = await processor.process({
    id: "job-1",
    name: "deliver-webhook-notification",
    data: buildJobData(),
  })

  assert.deepEqual(result, {
    delivered: false,
    reason: "no_match",
  })
  assert.equal(dispatchService.calls.length, 0)
})

test("processor short-circuits when the usage event no longer exists", async () => {
  const repository = new StubRepository(null, null, 0)
  const dispatchService = new RecordingDispatchService()
  const processor = new WebhookProcessor(
    repository as never,
    dispatchService as never
  )

  const result = await processor.process({
    id: "job-1",
    name: "deliver-webhook-notification",
    data: buildJobData(),
  })

  assert.deepEqual(result, {
    delivered: false,
    reason: "event_not_found",
  })
  assert.equal(dispatchService.calls.length, 0)
})

test("processor returns downstream failure details for queue logging", async () => {
  const repository = new StubRepository(buildEvent(), null, 1)
  const dispatchService = new RecordingDispatchService({
    ok: false,
    response: { status: 500, body: "downstream unavailable" },
    errorMessage: "Webhook responded with status 500: downstream unavailable",
    statusCode: 500,
    failureKind: "downstream_error",
  })
  const processor = new WebhookProcessor(
    repository as never,
    dispatchService as never
  )

  const result = await processor.process({
    id: "job-1",
    name: "deliver-webhook-notification",
    data: buildJobData(),
  })

  assert.deepEqual(result, {
    delivered: false,
    eventId: "event-1",
    failureKind: "downstream_error",
    logId: "event-1",
    reason: "delivery_failed",
    statusCode: 500,
  })
})

test("processor dispatches survey response events without log matching", async () => {
  const repository = new StubRepository(null, buildSurveyEvent(), 0)
  const dispatchService = new RecordingDispatchService()
  const processor = new WebhookProcessor(
    repository as never,
    dispatchService as never
  )

  const result = await processor.process({
    id: "job-2",
    name: "deliver-webhook-notification",
    data: buildJobData({
      event: {
        kind: "survey_response",
        id: "submission-1",
        occurredAt: "2026-03-31T12:00:00.000Z",
        trackableId: "trackable-1",
        workspaceId: "workspace-1",
      },
      triggerRule: {
        id: "rule-1",
        webhookId: "webhook-1",
        enabled: true,
        position: 0,
        config: {
          type: "survey_response_received",
        },
      },
    }),
  })

  assert.deepEqual(result, {
    delivered: true,
    eventId: "submission-1",
    failureKind: null,
    reason: "delivered",
    statusCode: 204,
    submissionId: "submission-1",
  })
  assert.equal(repository.queries.length, 0)
  assert.equal(dispatchService.calls.length, 1)
})
