import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement";
import {
	fetchLemonSqueezySubscription,
	resolveLemonSqueezyTier,
} from "@/server/subscriptions/lemon-squeezy";
import { processLemonSqueezyWebhook } from "@/server/subscriptions/process-lemon-squeezy-webhook";
import { subscriptionService } from "@/server/subscriptions/subscription-service.singleton";
import { verifyLemonSqueezyWebhook } from "@/server/subscriptions/webhook-verification";

export async function POST(request: Request) {
	const rawBody = await request.text();
	const signature = request.headers.get("x-signature") ?? "";

	return processLemonSqueezyWebhook(
		{
			rawBody,
			signature,
			webhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
			subscriptionsEnabled: isSubscriptionEnforcementEnabled(),
		},
		{
			verifyWebhook: verifyLemonSqueezyWebhook,
			fetchSubscription: fetchLemonSqueezySubscription,
			resolveTier: resolveLemonSqueezyTier,
			upsertWorkspaceSubscription: (input) =>
				subscriptionService.upsertWorkspaceSubscription(input),
		},
	);
}
