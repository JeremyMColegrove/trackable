import assert from "node:assert/strict"
import test from "node:test"

import { DiscordWebhookProvider } from "@/server/webhooks/providers/discord-webhook.provider"
import { GenericWebhookProvider } from "@/server/webhooks/providers/generic-webhook.provider"
import type {
  WebhookDeliveryContext,
  WebhookSurveyResponseEvent,
  WebhookUsageEvent,
} from "@/server/webhooks/webhook.types"

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_USAGE_EVENT: WebhookUsageEvent = {
  kind: "usage_event",
  id: "event-1",
  trackableId: "trackable-1",
  workspaceId: "workspace-1",
  occurredAt: new Date("2026-01-15T10:00:00.000Z"),
  payload: { level: "error", event: "payment_failed" },
  metadata: { logId: "log-abc", region: "us-east-1" },
}

const BASE_SURVEY_EVENT: WebhookSurveyResponseEvent = {
  kind: "survey_response",
  id: "resp-1",
  trackableId: "trackable-1",
  workspaceId: "workspace-1",
  occurredAt: new Date("2026-01-15T10:00:00.000Z"),
  payload: {
    source: "public_link",
    submitterLabel: "alice@example.com",
    submissionSnapshot: {} as never,
  },
  metadata: null,
}

const LOG_MATCH_RULE = {
  id: "rule-1",
  webhookId: "webhook-1",
  enabled: true,
  position: 0,
  config: { type: "log_match" as const, liqeQuery: "level:error" },
}

const SURVEY_RULE = {
  id: "rule-2",
  webhookId: "webhook-1",
  enabled: true,
  position: 0,
  config: { type: "survey_response_received" as const },
}

const BASE_MATCH = { ruleId: "rule-1", reason: "Matched filter: level:error" }

function makeGenericContext(
  overrides: Partial<WebhookDeliveryContext> = {}
): WebhookDeliveryContext {
  return {
    webhook: {
      id: "webhook-1",
      workspaceId: "workspace-1",
      name: "My Generic Webhook",
      provider: "generic",
      enabled: true,
      config: {
        provider: "generic",
        url: "https://example.com/hook",
        secret: "s3cr3t",
        headers: { "x-custom": "yes" },
      },
      triggerRules: [LOG_MATCH_RULE],
    },
    triggerRule: LOG_MATCH_RULE,
    event: BASE_USAGE_EVENT,
    match: BASE_MATCH,
    ...overrides,
  }
}

function makeDiscordContext(
  overrides: Partial<WebhookDeliveryContext> = {}
): WebhookDeliveryContext {
  return {
    webhook: {
      id: "webhook-1",
      workspaceId: "workspace-1",
      name: "My Discord Webhook",
      provider: "discord",
      enabled: true,
      config: {
        provider: "discord",
        url: "https://discord.com/api/webhooks/999/token",
        username: "Trackable Bot",
      },
      triggerRules: [LOG_MATCH_RULE],
    },
    triggerRule: LOG_MATCH_RULE,
    event: BASE_USAGE_EVENT,
    match: BASE_MATCH,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// GenericWebhookProvider
// ---------------------------------------------------------------------------

test("GenericWebhookProvider: POST to configured URL with JSON content-type", () => {
  const provider = new GenericWebhookProvider()
  const { request } = provider.buildRequest(makeGenericContext()).request
    ? provider.buildRequest(makeGenericContext())
    : { request: null as never }

  assert.equal(request.url, "https://example.com/hook")
  assert.equal(request.method, "POST")
  assert.equal(request.headers["content-type"], "application/json")
})

test("GenericWebhookProvider: includes secret header when configured", () => {
  const provider = new GenericWebhookProvider()
  const { request } = provider.buildRequest(makeGenericContext())

  assert.equal(request.headers["x-trackable-webhook-secret"], "s3cr3t")
})

test("GenericWebhookProvider: omits secret header when no secret", () => {
  const provider = new GenericWebhookProvider()
  const ctx = makeGenericContext()
  ctx.webhook.config = {
    provider: "generic",
    url: "https://example.com/hook",
    headers: {},
  }
  const { request } = provider.buildRequest(ctx)

  assert.equal("x-trackable-webhook-secret" in request.headers, false)
})

test("GenericWebhookProvider: merges custom headers", () => {
  const provider = new GenericWebhookProvider()
  const { request } = provider.buildRequest(makeGenericContext())

  assert.equal(
    (request.headers as Record<string, string | undefined>)["x-custom"],
    "yes"
  )
})

test("GenericWebhookProvider: body contains webhook, trigger, and event sections", () => {
  const provider = new GenericWebhookProvider()
  const { request } = provider.buildRequest(makeGenericContext())
  const body = JSON.parse(request.body) as {
    webhook: { id: string; name: string; provider: string }
    trigger: { id: string; type: string; reason: string }
    event: {
      kind: string
      id: string
      trackableId: string
      workspaceId: string
      occurredAt: string
      payload: Record<string, unknown>
      metadata: Record<string, unknown> | null
    }
  }

  assert.equal(body.webhook.id, "webhook-1")
  assert.equal(body.webhook.name, "My Generic Webhook")
  assert.equal(body.webhook.provider, "generic")

  assert.equal(body.trigger.id, "rule-1")
  assert.equal(body.trigger.type, "log_match")
  assert.equal(body.trigger.reason, "Matched filter: level:error")

  assert.equal(body.event.kind, "usage_event")
  assert.equal(body.event.id, "event-1")
  assert.equal(body.event.trackableId, "trackable-1")
  assert.equal(body.event.workspaceId, "workspace-1")
  assert.equal(body.event.occurredAt, "2026-01-15T10:00:00.000Z")
  assert.deepEqual(body.event.payload, {
    level: "error",
    event: "payment_failed",
  })
  assert.deepEqual(body.event.metadata, {
    logId: "log-abc",
    region: "us-east-1",
  })
})

test("GenericWebhookProvider: body handles null metadata", () => {
  const provider = new GenericWebhookProvider()
  const ctx = makeGenericContext()
  ctx.event = { ...BASE_USAGE_EVENT, metadata: null }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { event: { metadata: unknown } }

  assert.equal(body.event.metadata, null)
})

test("GenericWebhookProvider: throws when given a non-generic config", () => {
  const provider = new GenericWebhookProvider()
  const ctx = makeGenericContext()
  // Force a discord config onto a generic webhook
  ctx.webhook.config = {
    provider: "discord",
    url: "https://discord.com/api/webhooks/1/x",
  } as never

  assert.throws(
    () => provider.buildRequest(ctx),
    /GenericWebhookProvider received a non-generic webhook/
  )
})

// ---------------------------------------------------------------------------
// DiscordWebhookProvider — usage_event
// ---------------------------------------------------------------------------

test("DiscordWebhookProvider: POST to configured URL with JSON content-type", () => {
  const provider = new DiscordWebhookProvider()
  const { request } = provider.buildRequest(makeDiscordContext())

  assert.equal(request.url, "https://discord.com/api/webhooks/999/token")
  assert.equal(request.method, "POST")
  assert.equal(request.headers["content-type"], "application/json")
})

test("DiscordWebhookProvider: usage_event embed has correct title and field names", () => {
  const provider = new DiscordWebhookProvider()
  const { request } = provider.buildRequest(makeDiscordContext())
  const body = JSON.parse(request.body) as {
    embeds: Array<{ title: string; fields: Array<{ name: string }> }>
  }
  const embed = body.embeds[0]!

  assert.equal(embed.title, "Webhook fired: My Discord Webhook")
  const fieldNames = embed.fields.map((f) => f.name)
  assert.deepEqual(fieldNames, [
    "Trackable",
    "Trigger",
    "Filter",
    "Log ID",
    "Open Log",
  ])
})

test("DiscordWebhookProvider: usage_event embed uses logId from metadata", () => {
  const provider = new DiscordWebhookProvider()
  const { request } = provider.buildRequest(makeDiscordContext())
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>
  }
  const logIdField = body.embeds[0]!.fields.find((f) => f.name === "Log ID")!

  assert.equal(logIdField.value, "log-abc")
})

test("DiscordWebhookProvider: usage_event embed falls back to event.id when no metadata logId", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.event = { ...BASE_USAGE_EVENT, metadata: null }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>
  }
  const logIdField = body.embeds[0]!.fields.find((f) => f.name === "Log ID")!

  assert.equal(logIdField.value, "event-1")
})

test("DiscordWebhookProvider: usage_event embed falls back to event.id when logId is empty string", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.event = { ...BASE_USAGE_EVENT, metadata: { logId: "  " } }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>
  }
  const logIdField = body.embeds[0]!.fields.find((f) => f.name === "Log ID")!

  assert.equal(logIdField.value, "event-1")
})

test("DiscordWebhookProvider: usage_event embed description is the match reason", () => {
  const provider = new DiscordWebhookProvider()
  const { request } = provider.buildRequest(makeDiscordContext())
  const body = JSON.parse(request.body) as {
    embeds: Array<{ description: string }>
  }

  assert.equal(body.embeds[0]!.description, "Matched filter: level:error")
})

test("DiscordWebhookProvider: usage_event embed filter wraps liqeQuery in inline code", () => {
  const provider = new DiscordWebhookProvider()
  const { request } = provider.buildRequest(makeDiscordContext())
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>
  }
  const filterField = body.embeds[0]!.fields.find((f) => f.name === "Filter")!

  assert.equal(filterField.value, "`level:error`")
})

test("DiscordWebhookProvider: usage_event embed filter shows wildcard when no liqeQuery", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.triggerRule = {
    ...LOG_MATCH_RULE,
    config: { type: "survey_response_received" as const } as never,
  }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>
  }
  const filterField = body.embeds[0]!.fields.find((f) => f.name === "Filter")!

  assert.equal(filterField.value, "`*`")
})

test("DiscordWebhookProvider: usage_event embed truncates liqeQuery over 900 chars", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  const longQuery = "a".repeat(950)
  ctx.triggerRule = {
    ...LOG_MATCH_RULE,
    config: { type: "log_match", liqeQuery: longQuery },
  }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>
  }
  const filterField = body.embeds[0]!.fields.find((f) => f.name === "Filter")!

  // 900 chars + ellipsis + backtick wrapping
  assert.match(filterField.value, /^`a{900}…`$/)
})

// ---------------------------------------------------------------------------
// DiscordWebhookProvider — color resolution
// ---------------------------------------------------------------------------

test("DiscordWebhookProvider: error level maps to red color", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.event = { ...BASE_USAGE_EVENT, payload: { level: "error" } }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { embeds: Array<{ color: number }> }

  assert.equal(body.embeds[0]!.color, 0xed4245)
})

test("DiscordWebhookProvider: warn level maps to yellow color", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.event = { ...BASE_USAGE_EVENT, payload: { level: "warn" } }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { embeds: Array<{ color: number }> }

  assert.equal(body.embeds[0]!.color, 0xfee75c)
})

test("DiscordWebhookProvider: info level maps to blue color", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.event = { ...BASE_USAGE_EVENT, payload: { level: "info" } }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { embeds: Array<{ color: number }> }

  assert.equal(body.embeds[0]!.color, 0x5865f2)
})

test("DiscordWebhookProvider: unknown level maps to green color", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.event = { ...BASE_USAGE_EVENT, payload: { level: "debug" } }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { embeds: Array<{ color: number }> }

  assert.equal(body.embeds[0]!.color, 0x57f287)
})

test("DiscordWebhookProvider: missing level maps to green color", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.event = { ...BASE_USAGE_EVENT, payload: {} }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { embeds: Array<{ color: number }> }

  assert.equal(body.embeds[0]!.color, 0x57f287)
})

// ---------------------------------------------------------------------------
// DiscordWebhookProvider — username resolution
// ---------------------------------------------------------------------------

test("DiscordWebhookProvider: includes valid username", () => {
  const provider = new DiscordWebhookProvider()
  const { request } = provider.buildRequest(makeDiscordContext())
  const body = JSON.parse(request.body) as { username?: string }

  assert.equal(body.username, "Trackable Bot")
})

test("DiscordWebhookProvider: omits username when null", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.webhook.config = {
    provider: "discord",
    url: "https://discord.com/api/webhooks/999/token",
    username: null,
  }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { username?: string }

  assert.equal(body.username, undefined)
})

test("DiscordWebhookProvider: omits username when whitespace-only", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.webhook.config = {
    provider: "discord",
    url: "https://discord.com/api/webhooks/999/token",
    username: "   ",
  }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { username?: string }

  assert.equal(body.username, undefined)
})

test("DiscordWebhookProvider: omits username when it contains 'discord' (case-insensitive)", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()

  for (const name of ["Discord Alerts", "DISCORD", "my-discord-bot"]) {
    ctx.webhook.config = {
      provider: "discord",
      url: "https://discord.com/api/webhooks/999/token",
      username: name,
    }
    const { request } = provider.buildRequest(ctx)
    const body = JSON.parse(request.body) as { username?: string }
    assert.equal(
      body.username,
      undefined,
      `expected username omitted for "${name}"`
    )
  }
})

test("DiscordWebhookProvider: includes avatar_url when provided", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.webhook.config = {
    provider: "discord",
    url: "https://discord.com/api/webhooks/999/token",
    avatarUrl: "https://example.com/avatar.png",
  }
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { avatar_url?: string }

  assert.equal(body.avatar_url, "https://example.com/avatar.png")
})

test("DiscordWebhookProvider: avatar_url is undefined when not configured", () => {
  const provider = new DiscordWebhookProvider()
  const { request } = provider.buildRequest(makeDiscordContext())
  const body = JSON.parse(request.body) as { avatar_url?: string }

  assert.equal(body.avatar_url, undefined)
})

// ---------------------------------------------------------------------------
// DiscordWebhookProvider — survey_response event
// ---------------------------------------------------------------------------

test("DiscordWebhookProvider: survey_response embed has correct field names", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.triggerRule = SURVEY_RULE
  ctx.event = BASE_SURVEY_EVENT
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string }> }>
  }
  const fieldNames = body.embeds[0]!.fields.map((f) => f.name)

  assert.deepEqual(fieldNames, [
    "Trackable",
    "Trigger",
    "Submitter",
    "Source",
    "Response ID",
    "Open Response",
  ])
})

test("DiscordWebhookProvider: survey_response embed uses green color", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.triggerRule = SURVEY_RULE
  ctx.event = BASE_SURVEY_EVENT
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as { embeds: Array<{ color: number }> }

  assert.equal(body.embeds[0]!.color, 0x57f287)
})

test("DiscordWebhookProvider: survey_response embed includes submitter and source", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.triggerRule = SURVEY_RULE
  ctx.event = BASE_SURVEY_EVENT
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>
  }
  const fields = body.embeds[0]!.fields

  assert.equal(
    fields.find((f) => f.name === "Submitter")?.value,
    "alice@example.com"
  )
  assert.equal(fields.find((f) => f.name === "Source")?.value, "public_link")
  assert.equal(fields.find((f) => f.name === "Response ID")?.value, "resp-1")
})

test("DiscordWebhookProvider: survey_response embed includes Open Response link", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.triggerRule = SURVEY_RULE
  ctx.event = BASE_SURVEY_EVENT
  const { request } = provider.buildRequest(ctx)
  const body = JSON.parse(request.body) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>
  }
  const openField = body.embeds[0]!.fields.find(
    (f) => f.name === "Open Response"
  )!

  assert.match(
    openField.value,
    /\[Open filtered response\]\(https:\/\/.*\/dashboard\/trackables\/trackable-1\?q=resp-1\)/
  )
})

// ---------------------------------------------------------------------------
// DiscordWebhookProvider — guard
// ---------------------------------------------------------------------------

test("DiscordWebhookProvider: throws when given a non-discord config", () => {
  const provider = new DiscordWebhookProvider()
  const ctx = makeDiscordContext()
  ctx.webhook.config = {
    provider: "generic",
    url: "https://example.com/hook",
    headers: {},
  } as never

  assert.throws(
    () => provider.buildRequest(ctx),
    /DiscordWebhookProvider received a non-discord webhook/
  )
})
