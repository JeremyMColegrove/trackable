import { subscriptionService } from "@/server/subscriptions/subscription.service";
import type { SubscriptionTier } from "@/server/subscriptions/types";
import { verifyLemonSqueezyWebhook } from "@/server/subscriptions/webhook-verification";

type LemonSqueezySubscriptionStatus =
	| "on_trial"
	| "active"
	| "paused"
	| "past_due"
	| "unpaid"
	| "cancelled"
	| "expired";

interface WebhookPayload {
	meta: {
		event_name: string;
		custom_data?: {
			workspace_id?: string;
		};
	};
	data: {
		id: string;
		attributes: {
			store_id: number;
			customer_id: number;
			variant_id: number;
			status: LemonSqueezySubscriptionStatus;
			renews_at: string | null;
			ends_at: string | null;
			cancelled: boolean;
		};
	};
}

const SUBSCRIPTION_EVENTS = new Set([
	"subscription_created",
	"subscription_updated",
	"subscription_cancelled",
	"subscription_expired",
	"subscription_paused",
	"subscription_unpaused",
	"subscription_resumed",
	"subscription_payment_failed",
	"subscription_payment_recovered",
]);

function getVariantTierMap(): Record<string, SubscriptionTier> {
	const raw = process.env.LEMON_SQUEEZY_VARIANT_MAP;

	if (!raw) {
		return {};
	}

	return JSON.parse(raw) as Record<string, SubscriptionTier>;
}

function resolveVariantTier(variantId: string): SubscriptionTier {
	const map = getVariantTierMap();
	return map[variantId] ?? "free";
}

function mapLemonSqueezyStatus(
	status: LemonSqueezySubscriptionStatus,
): "active" | "cancelled" | "expired" | "paused" | "past_due" {
	switch (status) {
		case "on_trial":
		case "active":
			return "active";
		case "paused":
			return "paused";
		case "past_due":
		case "unpaid":
			return "past_due";
		case "cancelled":
			return "cancelled";
		case "expired":
			return "expired";
	}
}

function parseCurrentPeriodEnd(
	attributes: WebhookPayload["data"]["attributes"],
): Date | null {
	const dateStr = attributes.renews_at ?? attributes.ends_at;
	return dateStr ? new Date(dateStr) : null;
}

export async function POST(request: Request) {
	// if (areTiersUnlocked()) {
	//   return Response.json({ ok: true })
	// }

	const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

	if (!webhookSecret) {
		console.error("Missing LEMON_SQUEEZY_WEBHOOK_SECRET");

		return Response.json(
			{ error: "Webhook secret is not configured." },
			{ status: 500 },
		);
	}

	const rawBody = await request.text();
	const signature = request.headers.get("x-signature") ?? "";

	if (!verifyLemonSqueezyWebhook(rawBody, signature, webhookSecret)) {
		return Response.json(
			{ error: "Invalid webhook signature." },
			{ status: 400 },
		);
	}

	let payload: WebhookPayload;

	try {
		payload = JSON.parse(rawBody) as WebhookPayload;
	} catch {
		return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
	}

	const eventName = payload.meta.event_name;

	if (!SUBSCRIPTION_EVENTS.has(eventName)) {
		return Response.json({ ok: true });
	}

	const workspaceId = payload.meta.custom_data?.workspace_id;

	if (!workspaceId) {
		console.error(
			`Lemon Squeezy webhook ${eventName} missing workspace_id in custom_data`,
		);

		return Response.json(
			{ error: "Missing workspace_id in custom_data." },
			{ status: 400 },
		);
	}

	const { attributes, id: subscriptionId } = payload.data;
	const variantId = String(attributes.variant_id);
	const customerId = String(attributes.customer_id);

	try {
		await subscriptionService.upsertFromWebhook({
			workspaceId,
			lemonSqueezySubscriptionId: subscriptionId,
			lemonSqueezyCustomerId: customerId,
			variantId,
			tier: resolveVariantTier(variantId),
			status: mapLemonSqueezyStatus(attributes.status),
			currentPeriodEnd: parseCurrentPeriodEnd(attributes),
		});
	} catch (error) {
		console.error("Failed to process Lemon Squeezy webhook", error);

		return Response.json(
			{ error: "Failed to process webhook event." },
			{ status: 500 },
		);
	}

	return Response.json({ ok: true });
}
