import { getTierLimits } from "@/lib/workspace-tier-config";
import type { WorkspaceSubscriptionRepository } from "@/server/subscriptions/subscription.repository";
import type {
	SubscriptionTier,
	TierLimits,
	WorkspaceSubscriptionState,
	WorkspaceSubscriptionUpsertInput,
} from "@/server/subscriptions/types";

export class SubscriptionService {
	constructor(
		private readonly repository: WorkspaceSubscriptionRepository,
		private readonly subscriptionEnforcementEnabled: () => boolean,
	) {}

	async ensureFreeWorkspaceSubscription(
		workspaceId: string,
	): Promise<WorkspaceSubscriptionState> {
		if (!this.subscriptionEnforcementEnabled()) {
			return this.buildSubscriptionsDisabledState(workspaceId);
		}

		const existing = await this.repository.findByWorkspaceId(workspaceId);

		if (existing) {
			return existing;
		}

		const freeSubscription: WorkspaceSubscriptionUpsertInput = {
			workspaceId,
			lemonSqueezySubscriptionId: null,
			lemonSqueezyCustomerId: null,
			variantId: null,
			tier: "free",
			status: "active",
			currentPeriodEnd: null,
		};

		await this.repository.upsert(freeSubscription);

		return freeSubscription;
	}

	async getWorkspaceSubscription(
		workspaceId: string,
	): Promise<WorkspaceSubscriptionState> {
		if (!this.subscriptionEnforcementEnabled()) {
			return this.buildSubscriptionsDisabledState(workspaceId);
		}

		const existing = await this.repository.findByWorkspaceId(workspaceId);

		if (existing) {
			return existing;
		}

		return this.ensureFreeWorkspaceSubscription(workspaceId);
	}

	async upsertWorkspaceSubscription(input: WorkspaceSubscriptionUpsertInput) {
		if (!this.subscriptionEnforcementEnabled()) {
			return;
		}

		await this.repository.upsert(input);
	}

	async getWorkspaceTier(workspaceId: string): Promise<SubscriptionTier> {
		if (!this.subscriptionEnforcementEnabled()) {
			return "pro";
		}

		const subscription = await this.getWorkspaceSubscription(workspaceId);

		if (subscription.status !== "active") {
			return "free";
		}

		return subscription.tier;
	}

	async getWorkspaceLimits(workspaceId: string): Promise<TierLimits> {
		if (!this.subscriptionEnforcementEnabled()) {
			return getTierLimits("pro");
		}

		const tier = await this.getWorkspaceTier(workspaceId);
		return getTierLimits(tier);
	}

	private buildSubscriptionsDisabledState(
		workspaceId: string,
	): WorkspaceSubscriptionState {
		return {
			workspaceId,
			lemonSqueezySubscriptionId: null,
			lemonSqueezyCustomerId: null,
			variantId: null,
			tier: "pro",
			status: "active",
			currentPeriodEnd: null,
		};
	}
}
