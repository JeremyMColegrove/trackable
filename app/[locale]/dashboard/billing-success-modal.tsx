"use client"

import { useAppSettings } from "@/components/app-settings-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { SubscriptionTier } from "@/server/subscriptions/types"
import {
  AlertTriangleIcon,
  ArrowRightLeftIcon,
  CheckIcon,
  InfoIcon,
  SparklesIcon,
} from "lucide-react"

export type BillingSuccessScenario =
  | { type: "new"; toTier: SubscriptionTier }
  | { type: "upgrade"; fromTier: SubscriptionTier; toTier: SubscriptionTier }
  | { type: "downgrade"; fromTier: SubscriptionTier; toTier: SubscriptionTier }

interface BillingSuccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenario: BillingSuccessScenario
}

function getScenarioContent(
  scenario: BillingSuccessScenario,
  getWorkspaceTierPlan: ReturnType<
    typeof useAppSettings
  >["getWorkspaceTierPlan"]
) {
  const toPlan = getWorkspaceTierPlan(scenario.toTier)
  const toPrice = toPlan.priceLabel

  switch (scenario.type) {
    case "new":
      return {
        icon: <SparklesIcon className="size-8 text-white/90" />,
        title: `Welcome to ${toPlan.name}!`,
        subtitle: "Your workspace is now upgraded and ready to go.",
        billingNote: `Your subscription is active at ${toPrice}/month per workspace. You can manage or cancel anytime from the billing portal.`,
        warningNote: null,
        ctaLabel: "Get Started",
      }
    case "upgrade": {
      const fromPlan = getWorkspaceTierPlan(scenario.fromTier)
      return {
        icon: <SparklesIcon className="size-8 text-white/90" />,
        title: `Upgraded to ${toPlan.name}!`,
        subtitle: `You've upgraded from ${fromPlan.name} to ${toPlan.name}.`,
        billingNote: `A prorated charge has been applied for the remainder of your current billing period. Future invoices will be ${toPrice}/month.`,
        warningNote: null,
        ctaLabel: "Got it",
      }
    }
    case "downgrade": {
      const fromPlan = getWorkspaceTierPlan(scenario.fromTier)
      return {
        icon: <ArrowRightLeftIcon className="size-7 text-white/90" />,
        title: `Switched to ${toPlan.name}`,
        subtitle: `You've switched from ${fromPlan.name} to ${toPlan.name}.`,
        billingNote: `A prorated credit for unused time on your ${fromPlan.name} plan has been applied to your account. Your new rate of ${toPrice}/month takes effect on the next invoice.`,
        warningNote:
          "Some limits have been reduced. Make sure your current usage stays within the new plan's limits.",
        ctaLabel: "Got it",
      }
    }
  }
}

export function BillingSuccessModal({
  open,
  onOpenChange,
  scenario,
}: BillingSuccessModalProps) {
  const { getWorkspaceTierPlan } = useAppSettings()
  const toPlan = getWorkspaceTierPlan(scenario.toTier)
  const toTierRank = toPlan.rank
  const isDowngrade = scenario.type === "downgrade"
  const content = getScenarioContent(scenario, getWorkspaceTierPlan)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-none p-0 shadow-2xl sm:max-w-md">
        {/* Gradient header */}
        <div
          className={cn(
            "flex flex-col items-center gap-3 px-6 py-8 text-center",
            isDowngrade
              ? "bg-linear-to-br from-slate-600 via-slate-700 to-slate-800"
              : toTierRank >= 2
                ? "bg-linear-to-br from-violet-600 via-purple-600 to-indigo-600"
                : "bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500"
          )}
        >
          <div className="flex size-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
            {content.icon}
          </div>
          <DialogHeader className="gap-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {content.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/75 sm:text-[15px]">
              {content.subtitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-6">
          {/* Plan highlights */}
          <div>
            <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {toPlan.name} includes
            </p>
            <ul className="space-y-2">
              {toPlan.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-2.5 text-sm text-foreground/85"
                >
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Billing / proration note */}
          <div className="flex gap-3 rounded-xl border bg-muted/40 px-4 py-3">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-snug text-muted-foreground">
              {content.billingNote}
            </p>
          </div>

          {/* Downgrade warning */}
          {content.warningNote && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm leading-snug text-amber-800 dark:text-amber-300">
                {content.warningNote}
              </p>
            </div>
          )}

          <Button
            size="lg"
            className="w-full rounded-xl font-semibold"
            onClick={() => onOpenChange(false)}
          >
            {content.ctaLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
