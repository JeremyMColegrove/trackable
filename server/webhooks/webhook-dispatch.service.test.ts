import assert from "node:assert/strict"
import test from "node:test"

import { WebhookDispatchService } from "@/server/webhooks/webhook-dispatch.service"
import { WebhookProviderRegistry } from "@/server/webhooks/webhook-provider-registry"
import { DiscordWebhookProvider } from "@/server/webhooks/providers/discord-webhook.provider"
import { GenericWebhookProvider } from "@/server/webhooks/providers/generic-webhook.provider"
import type {
  WebhookDeliveryContext,
  WebhookHttpClient,
} from "@/server/webhooks/webhook.types"

class StubHttpClient implements WebhookHttpClient {
  constructor(
    private readonly response: {
      status: number
      body: string
    } = {
      status: 204,
      body: "",
    }
  ) {}

  public requests: Array<{
    url: string
    method: "POST"
    headers: Record<string, string>
    body: string
  }> = []

  async send(request: {
    url: string
    method: "POST"
    headers: Record<string, string>
    body: string
  }) {
    this.requests.push(request)

    return this.response
  }
}

class ThrowingHttpClient implements WebhookHttpClient {
  async send(): Promise<{ status: number; body: string | null }> {
    throw new Error("connect ECONNREFUSED 127.0.0.1:443")
  }
}

class StubDeliveryRepository {
  public attempts: Array<Record<string, unknown>> = []

  async createAttempt(input: Record<string, unknown>) {
    this.attempts.push(input)
  }
}

function buildContext(provider: "discord" | "generic"): WebhookDeliveryContext {
  return {
    webhook: {
      id: "webhook-1",
      workspaceId: "workspace-1",
      name: provider === "generic" ? "Generic webhook" : "Discord webhook",
      provider,
      enabled: true,
      config:
        provider === "generic"
          ? {
              provider: "generic",
              url: "https://example.com/hook",
              secret: "top-secret",
              headers: {
                "x-custom": "true",
              },
            }
          : {
              provider: "discord",
              url: "https://discord.com/api/webhooks/123/abc",
              username: "Trackable Bot",
            },
      triggerRules: [
        {
          id: "rule-1",
          webhookId: "webhook-1",
          enabled: true,
          position: 0,
          config: {
            type: "log_match",
            liqeQuery: "level:error",
          },
        },
      ],
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
    event: {
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
        logId: "log-123",
        region: "us-east-1",
      },
    },
    match: {
      ruleId: "rule-1",
      reason: "Log matched filter: level:error",
    },
  }
}

test("generic webhook delivery posts normalized JSON to the configured URL", async () => {
  const httpClient = new StubHttpClient()
  const deliveryRepository = new StubDeliveryRepository()
  const service = new WebhookDispatchService(
    new WebhookProviderRegistry([new GenericWebhookProvider()]),
    httpClient,
    deliveryRepository as never
  )

  const result = await service.dispatch(buildContext("generic"))

  assert.equal(result.ok, true)
  assert.equal(result.statusCode, 204)
  assert.equal(result.failureKind, null)
  assert.equal(httpClient.requests[0]?.url, "https://example.com/hook")
  assert.equal(
    httpClient.requests[0]?.headers["x-trackable-webhook-secret"],
    "top-secret"
  )

  const body = JSON.parse(httpClient.requests[0]?.body ?? "{}") as Record<
    string,
    unknown
  >
  assert.equal((body.webhook as { provider: string }).provider, "generic")
  assert.equal((body.trigger as { type: string }).type, "log_match")
  assert.equal((body.event as { id: string }).id, "event-1")
})

test("Discord webhook delivery sends an embed-shaped payload", async () => {
  const httpClient = new StubHttpClient()
  const deliveryRepository = new StubDeliveryRepository()
  const service = new WebhookDispatchService(
    new WebhookProviderRegistry([new DiscordWebhookProvider()]),
    httpClient,
    deliveryRepository as never
  )

  const result = await service.dispatch(buildContext("discord"))

  assert.equal(result.ok, true)
  assert.equal(result.statusCode, 204)
  assert.equal(result.failureKind, null)
  assert.equal(
    httpClient.requests[0]?.url,
    "https://discord.com/api/webhooks/123/abc"
  )

  const body = JSON.parse(httpClient.requests[0]?.body ?? "{}") as {
    embeds?: Array<{
      title: string
      fields: Array<{ name: string; value: string }>
    }>
    username?: string
  }
  assert.equal(body.username, "Trackable Bot")
  assert.equal(body.embeds?.[0]?.title, "Webhook fired: Discord webhook")
  assert.equal(body.embeds?.[0]?.fields.length, 5)
  assert.equal(body.embeds?.[0]?.fields[0]?.name, "Trackable")
  assert.equal(body.embeds?.[0]?.fields[2]?.name, "Filter")
  assert.equal(body.embeds?.[0]?.fields[2]?.value, "`level:error`")
  assert.equal(body.embeds?.[0]?.fields[3]?.name, "Log ID")
  assert.equal(body.embeds?.[0]?.fields[3]?.value, "log-123")
  assert.match(
    body.embeds?.[0]?.fields[4]?.value ?? "",
    /\[Open filtered logs\]\(https:\/\/trackables\.org\/dashboard\/trackables\/trackable-1\?q=metadata\.logId%3A%22log-123%22\)/
  )
})

test("Discord webhook delivery omits invalid usernames", async () => {
  const httpClient = new StubHttpClient()
  const deliveryRepository = new StubDeliveryRepository()
  const service = new WebhookDispatchService(
    new WebhookProviderRegistry([new DiscordWebhookProvider()]),
    httpClient,
    deliveryRepository as never
  )

  const context = buildContext("discord")
  context.webhook.config = {
    provider: "discord",
    url: "https://discord.com/api/webhooks/123/abc",
    username: "Discord Alerts",
  }

  const result = await service.dispatch(context)

  assert.equal(result.ok, true)
  assert.equal(result.statusCode, 204)
  assert.equal(result.failureKind, null)

  const body = JSON.parse(httpClient.requests[0]?.body ?? "{}") as {
    username?: string
  }
  assert.equal("username" in body, false)
})

test("failed webhook delivery includes the downstream response body", async () => {
  const httpClient = new StubHttpClient({
    status: 400,
    body: '{"message":"Invalid Form Body"}',
  })
  const deliveryRepository = new StubDeliveryRepository()
  const service = new WebhookDispatchService(
    new WebhookProviderRegistry([new DiscordWebhookProvider()]),
    httpClient,
    deliveryRepository as never
  )

  const result = await service.dispatch(buildContext("discord"))

  assert.equal(result.ok, false)
  assert.equal(result.statusCode, 400)
  assert.equal(result.failureKind, "downstream_error")
  assert.equal(
    result.errorMessage,
    'Webhook responded with status 400: {"message":"Invalid Form Body"}'
  )
})

test("transport webhook delivery failures are surfaced distinctly", async () => {
  const deliveryRepository = new StubDeliveryRepository()
  const service = new WebhookDispatchService(
    new WebhookProviderRegistry([new GenericWebhookProvider()]),
    new ThrowingHttpClient(),
    deliveryRepository as never
  )

  const result = await service.dispatch(buildContext("generic"))

  assert.equal(result.ok, false)
  assert.equal(result.statusCode, null)
  assert.equal(result.failureKind, "transport_error")
  assert.equal(result.errorMessage, "connect ECONNREFUSED 127.0.0.1:443")
})
