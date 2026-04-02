import { DiscordWebhookProvider } from "@/server/webhooks/providers/discord-webhook.provider"
import { GenericWebhookProvider } from "@/server/webhooks/providers/generic-webhook.provider"
import type { WebhookProvider } from "@/db/schema/types"
import type { WebhookProviderContract } from "@/server/webhooks/webhook.types"

export class WebhookProviderRegistry {
  private readonly providers = new Map<WebhookProvider, WebhookProviderContract>()

  constructor(providers: WebhookProviderContract[]) {
    for (const provider of providers) {
      this.providers.set(provider.provider, provider)
    }
  }

  get(provider: WebhookProvider) {
    const resolved = this.providers.get(provider)

    if (!resolved) {
      throw new Error(`Unsupported webhook provider: ${provider}`)
    }

    return resolved
  }
}

export const webhookProviderRegistry = new WebhookProviderRegistry([
  new GenericWebhookProvider(),
  new DiscordWebhookProvider(),
])
