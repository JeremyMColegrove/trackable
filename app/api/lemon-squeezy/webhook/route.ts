import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement"
import { workspaceSubscriptionRepository } from "@/server/subscriptions/subscription.repository"
import { LemonSqueezySyncService } from "@/server/subscriptions/lemon-squeezy-sync.service"
import { LemonSqueezyWebhookHandler } from "@/server/subscriptions/lemon-squeezy-webhook-handler"
import { verifyLemonSqueezyWebhook } from "@/server/subscriptions/webhook-verification"

const syncService = new LemonSqueezySyncService(workspaceSubscriptionRepository)

const webhookHandler = new LemonSqueezyWebhookHandler({
  subscriptionsEnabled: isSubscriptionEnforcementEnabled,
  webhookSecret: () => process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  verifyWebhook: verifyLemonSqueezyWebhook,
  syncService,
})

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-signature") ?? ""

  return webhookHandler.handle({ rawBody, signature })
}
