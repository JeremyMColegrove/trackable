/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
	getWorkspaceTierPlan,
	getWorkspaceTierPlans,
	WORKSPACE_BILLING_ENABLED,
} from "@/lib/workspace-tier-config";
import type { SubscriptionTier } from "@/server/subscriptions/types";
import { T } from "gt-next";
import { CheckIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

function getPlanCtaLabel(
	tier: SubscriptionTier,
	currentTier: SubscriptionTier,
) {
	if (tier === currentTier) {
		return <T>Manage</T>;
	}

	return <T>Switch</T>;
}

export function WorkspaceTierDialog({
	currentTier,
	open,
	onOpenChange,
}: {
	currentTier: SubscriptionTier;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const plans = getWorkspaceTierPlans();
	const currentPlan = getWorkspaceTierPlan(currentTier);
	const freePlan = getWorkspaceTierPlan("free");

	if (!WORKSPACE_BILLING_ENABLED) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-h-[90vh] overflow-y-auto border-none p-0 shadow-2xl sm:max-w-4xl sm:rounded-2xl">
					<div className="bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 py-3 text-center sm:px-8 sm:py-4">
						<DialogHeader className="gap-1.5">
							<DialogTitle className="text-center text-xl font-bold tracking-tight text-white sm:text-2xl">
								<T>Billing is coming soon</T>
							</DialogTitle>
							<DialogDescription className="mx-auto max-w-lg text-center text-sm text-white/80 sm:text-[15px]">
								<T>
									Every workspace is currently on the Free tier while paid
									billing is being finalized.
								</T>
							</DialogDescription>
						</DialogHeader>
					</div>

					<div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:gap-4 sm:px-6 sm:py-6">
						<div className="relative flex flex-col rounded-2xl border border-border bg-muted/20 p-4 shadow-sm transition-all duration-200 hover:shadow-md sm:p-5">
							<div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center justify-center">
								<Badge className="h-auto rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm hover:bg-emerald-600">
									<T>Current Plan</T>
								</Badge>
							</div>

							<div className="mb-3">
								<h3 className="text-base font-bold text-foreground sm:text-lg">
									{freePlan.name}
								</h3>
								<p className="mt-1.5 text-sm leading-snug text-muted-foreground sm:min-h-[34px]">
									{freePlan.summary}
								</p>
							</div>

							<div className="mb-4 flex items-end gap-1.5 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
								{freePlan.priceLabel}
								<span className="pb-1 text-xs leading-tight font-medium text-muted-foreground sm:text-sm">
									<T>per workspace</T>
								</span>
							</div>

							<ul className="mb-5 flex-1 space-y-2.5">
								{freePlan.highlights.map((highlight, index) => (
									<li
										key={index}
										className="flex items-start gap-2.5 text-xs leading-snug text-foreground/85 sm:text-sm"
									>
										<CheckIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60 sm:size-4" />
										<span>{highlight}</span>
									</li>
								))}
							</ul>

							<Button
								type="button"
								variant="outline"
								size="lg"
								className="mt-auto w-full rounded-xl border-foreground/10 font-semibold text-foreground/70"
								onClick={() => onOpenChange(false)}
							>
								<T>Continue on Free</T>
							</Button>
						</div>

						<div className="relative flex flex-col rounded-2xl border border-primary/40 bg-linear-to-b from-background to-primary/2 p-4 shadow-sm ring-1 ring-primary/5 transition-all duration-200 hover:shadow-md sm:p-5">
							<div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center justify-center">
								<Badge className="h-auto rounded-full bg-primary px-3 py-1 text-[10px] font-bold tracking-wider text-primary-foreground uppercase shadow-sm hover:bg-primary">
									<T>Coming Soon</T>
								</Badge>
							</div>

							<div className="mb-3">
								<h3 className="text-base font-bold text-foreground sm:text-lg">
									<T>Paid Plans</T>
								</h3>
								<p className="mt-1.5 text-sm leading-snug text-muted-foreground sm:min-h-[34px]">
									<T>
										Upgrade options will return here once billing is enabled.
									</T>
								</p>
							</div>

							<div className="mb-4 flex items-end gap-1.5 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
								<T>Paid Plans</T>
							</div>

							<ul className="mb-5 flex-1 space-y-2.5">
								{[
									<T key="usage">
										Upgrade the workspace for higher usage limits
									</T>,
									<T key="members">
										Add more teammates and expand workspace capacity
									</T>,
									<T key="retention">
										Increase API log retention for longer history and reporting
									</T>,
									<T key="scale">
										Unlock higher-volume plans as your usage grows
									</T>,
								].map((highlight, index) => (
									<li
										key={index}
										className="flex items-start gap-2.5 text-xs leading-snug text-foreground/85 sm:text-sm"
									>
										<CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary sm:size-4" />
										<span>{highlight}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto border-none p-0 shadow-2xl sm:max-w-4xl sm:rounded-2xl">
				<div className="bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 py-3 text-center sm:px-8 sm:py-4">
					<DialogHeader className="gap-1.5">
						<DialogTitle className="text-center text-xl font-bold tracking-tight text-white sm:text-2xl">
							<T>Choose your plan</T>
						</DialogTitle>
						<DialogDescription className="mx-auto max-w-lg text-center text-sm text-white/80 sm:text-[15px]">
							<T>
								Select the perfect plan for your workspace needs. Upgrade
								anytime as you grow. All paid plans are billed per workspace per
								month.
							</T>
						</DialogDescription>
					</DialogHeader>
				</div>

				<div className="grid gap-4 px-4 py-5 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-6">
					{plans.map((plan) => {
						const tier = plan.tier;
						const isCurrent = tier === currentTier;
						const isMostPopular = plan.mostPopular;
						const ctaHref = isCurrent ? currentPlan.manageUrl : plan.switchUrl;
						const ctaDisabled = !ctaHref;
						const ctaLabel = getPlanCtaLabel(tier, currentTier);

						return (
							<div
								key={tier}
								className={cn(
									"relative flex flex-col rounded-2xl border bg-background p-4 shadow-sm transition-all duration-200 hover:shadow-md sm:p-5",
									isMostPopular
										? "z-10 mt-3 border-primary/40 bg-linear-to-b from-background to-primary/2 ring-1 shadow-primary/5 ring-primary/5 sm:mt-0 sm:scale-[1.02]"
										: "border-border/70",
									isCurrent && !isMostPopular
										? "border-border bg-muted/20"
										: "",
								)}
							>
								{(isCurrent || isMostPopular) && (
									<div className="absolute -top-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 sm:flex-row">
										{isCurrent ? (
											<Badge className="h-auto rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm hover:bg-emerald-600">
												<T>Current Plan</T>
											</Badge>
										) : null}
										{isMostPopular ? (
											<Badge className="h-auto rounded-full bg-primary px-3 py-1 text-[10px] font-bold tracking-wider text-primary-foreground uppercase shadow-sm hover:bg-primary">
												<T>Best Seller</T>
											</Badge>
										) : null}
									</div>
								)}

								<div className="mb-3">
									<h3 className="text-base font-bold text-foreground sm:text-lg">
										{plan.name}
									</h3>
									<p className="mt-1.5 text-sm leading-snug text-muted-foreground sm:min-h-[34px]">
										{plan.summary}
									</p>
								</div>

								<div className="mb-4 flex items-end gap-1.5 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
									{plan.priceLabel}
									<span className="pb-1 text-xs leading-tight font-medium text-muted-foreground sm:text-sm">
										<T>per workspace</T>
										<br />
										<T>per month</T>
									</span>
								</div>

								<ul className="mb-5 flex-1 space-y-2.5">
									{plan.highlights.map((highlight, i) => (
										<li
											key={i}
											className="flex items-start gap-2.5 text-xs leading-snug text-foreground/85 sm:text-sm"
										>
											<CheckIcon
												className={cn(
													"mt-0.5 size-3.5 shrink-0 sm:size-4",
													isMostPopular
														? "text-primary"
														: "text-muted-foreground/60",
												)}
											/>
											<span>{highlight}</span>
										</li>
									))}
								</ul>

								<Button
									asChild={!ctaDisabled}
									size="lg"
									variant={
										isCurrent
											? "outline"
											: isMostPopular
												? "default"
												: "secondary"
									}
									className={cn(
										"mt-auto w-full rounded-xl font-semibold transition-transform active:scale-[0.98]",
										isMostPopular && !isCurrent
											? "bg-primary shadow-md hover:bg-primary/90 hover:shadow-lg"
											: "",
										isCurrent ? "border-foreground/10 text-foreground/70" : "",
									)}
									disabled={ctaDisabled}
								>
									{ctaHref ? (
										<Link
											href={ctaHref}
											target="_blank"
											rel="noreferrer"
											onClick={() => onOpenChange(false)}
										>
											{isMostPopular && !isCurrent ? (
												<SparklesIcon className="mr-2 size-4 fill-primary-foreground/30" />
											) : null}
											{ctaLabel}
										</Link>
									) : (
										<>
											{isMostPopular && !isCurrent ? (
												<SparklesIcon className="mr-2 size-4 fill-primary-foreground/30" />
											) : null}
											{ctaLabel}
										</>
									)}
								</Button>
							</div>
						);
					})}
				</div>
			</DialogContent>
		</Dialog>
	);
}
