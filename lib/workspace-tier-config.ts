import type {
	SubscriptionTier,
	TierLimits,
} from "@/server/subscriptions/types";

export interface WorkspaceTierPlan {
	tier: SubscriptionTier;
	rank: number;
	name: string;
	mostPopular: boolean;
	priceLabel: string;
	priceInterval: string;
	summary: string;
	highlights: string[];
	switchUrl: string | null;
	manageUrl: string | null;
	limits: TierLimits;
	tone: "neutral" | "accent" | "strong";
}

function formatUsageLimit(
	value: number | null,
	singularLabel: string,
	pluralLabel: string,
) {
	return value === null
		? `Unlimited ${pluralLabel}`
		: `${value} ${value === 1 ? singularLabel : pluralLabel}`;
}

function buildTierHighlights(limits: TierLimits): string[] {
	return [
		formatUsageLimit(
			limits.maxWorkspaceMembers,
			"workspace member",
			"workspace members",
		),
		formatUsageLimit(
			limits.maxTrackableItems,
			"active trackable",
			"active trackables",
		),
		formatUsageLimit(
			limits.maxResponsesPerSurvey,
			"response per survey",
			"responses per survey",
		),
		formatUsageLimit(
			limits.maxApiLogsPerSecond,
			"API log per second",
			"API logs per second",
		),
		limits.logRetentionDays === null
			? "Unlimited API log retention"
			: `${limits.logRetentionDays}-day API log retention`,
	];
}

const FREE_LIMITS: TierLimits = {
	maxTrackableItems: 10,
	maxResponsesPerSurvey: 100,
	maxWorkspaceMembers: 2,
	maxApiLogsPerSecond: 1,
	logRetentionDays: 3,
};

const PLUS_LIMITS: TierLimits = {
	maxTrackableItems: 100,
	maxResponsesPerSurvey: null,
	maxWorkspaceMembers: 100,
	maxApiLogsPerSecond: 10,
	logRetentionDays: 90,
};

const PRO_LIMITS: TierLimits = {
	maxTrackableItems: null,
	maxResponsesPerSurvey: null,
	maxWorkspaceMembers: null,
	maxApiLogsPerSecond: null,
	logRetentionDays: null,
};

const WORKSPACE_TIER_PLAN_LIST: WorkspaceTierPlan[] = [
	{
		tier: "free",
		rank: 0,
		name: "Free",
		mostPopular: false,
		priceLabel: "$0",
		priceInterval: "/workspace",
		summary: "A clean starting point for new workspaces.",
		highlights: buildTierHighlights(FREE_LIMITS),
		switchUrl:
			"https://store.trackables.org/checkout/buy/500a54dd-0570-4265-a2a3-d09adacd156a",
		manageUrl: "https://store.trackables.org/billing",
		limits: FREE_LIMITS,
		tone: "neutral",
	},
	{
		tier: "plus",
		rank: 1,
		name: "Plus",
		mostPopular: true,
		priceLabel: "$24",
		priceInterval: "/workspace",
		summary: "More room for growing teams and heavier usage.",
		highlights: buildTierHighlights(PLUS_LIMITS),
		switchUrl:
			"https://store.trackables.org/checkout/buy/500a54dd-0570-4265-a2a3-d09adacd156a",
		manageUrl: "https://store.trackables.org/billing",
		limits: PLUS_LIMITS,
		tone: "accent",
	},
	{
		tier: "pro",
		rank: 2,
		name: "Pro",
		mostPopular: false,
		priceLabel: "$79",
		priceInterval: "/workspace",
		summary: "Expanded limits for high-volume workspaces.",
		highlights: buildTierHighlights(PRO_LIMITS),
		switchUrl:
			"https://store.trackables.org/checkout/buy/500a54dd-0570-4265-a2a3-d09adacd156a",
		manageUrl: "https://store.trackables.org/billing",
		limits: PRO_LIMITS,
		tone: "strong",
	},
];

export const WORKSPACE_TIER_PLANS = WORKSPACE_TIER_PLAN_LIST.reduce(
	(plans, plan) => {
		plans[plan.tier] = plan;
		return plans;
	},
	{} as Record<SubscriptionTier, WorkspaceTierPlan>,
);

export const WORKSPACE_TIER_ORDER = WORKSPACE_TIER_PLAN_LIST.map((plan) => plan)
	.sort((left, right) => left.rank - right.rank)
	.map((plan) => plan.tier);

export function getWorkspaceTierPlans(): readonly WorkspaceTierPlan[] {
	return [...WORKSPACE_TIER_PLAN_LIST].sort(
		(left, right) => left.rank - right.rank,
	);
}

export function getWorkspaceTierPlan(
	tier: SubscriptionTier,
): WorkspaceTierPlan {
	return WORKSPACE_TIER_PLANS[tier];
}

export function getTierLimits(tier: SubscriptionTier): TierLimits {
	return WORKSPACE_TIER_PLANS[tier].limits;
}
