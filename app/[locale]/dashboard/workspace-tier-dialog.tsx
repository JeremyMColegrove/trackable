/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAppSettings } from "@/components/app-settings-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useTRPC } from "@/trpc/client"
import { useQueryClient } from "@tanstack/react-query"
import { T } from "gt-next"
import { CheckIcon, Loader2Icon, SparklesIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import {
  BillingSuccessModal,
  type BillingSuccessScenario,
} from "@/app/[locale]/dashboard/billing-success-modal"

function getPlanCtaLabel(
  planRank: number,
  currentRank: number,
  isCurrent: boolean
) {
  if (isCurrent) return <T>Manage</T>
  return planRank > currentRank ? <T>Upgrade</T> : <T>Downgrade</T>
}

export function WorkspaceTierDialog({
  currentTier,
  workspaceId,
  initialTier,
  open,
  onOpenChange,
}: {
  currentTier: string
  workspaceId: string
  initialTier?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const {
    getWorkspacePlan,
    resolveWorkspaceTierFromVariantId,
    workspaceBillingEnabled,
    workspacePlans,
    defaultTierId,
  } = useAppSettings()
  const plans = workspacePlans
  const currentPlan = getWorkspacePlan(currentTier)
  const defaultPlan = getWorkspacePlan(defaultTierId)
  const mostPopularPlan = plans.find((plan) => plan.mostPopular) ?? null
  const currentRank = currentPlan?.rank ?? 0
  const isCurrentTierAboveMostPopular =
    mostPopularPlan !== null && currentRank > (mostPopularPlan.rank ?? 0)
  const highlightedTierId = isCurrentTierAboveMostPopular
    ? currentTier
    : (mostPopularPlan?.tierId ?? currentTier)
  const [loadingVariantId, setLoadingVariantId] = useState<string | null>(null)
  const [successScenario, setSuccessScenario] =
    useState<BillingSuccessScenario | null>(null)
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  async function handleCheckout(variantId: string) {
    setLoadingVariantId(variantId)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, workspaceId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update plan. Please try again.")
        return
      }
      if (data.switched) {
        const toTier = resolveWorkspaceTierFromVariantId(variantId)
        await queryClient.invalidateQueries(
          trpc.account.getWorkspaceContext.queryFilter()
        )
        onOpenChange(false)
        if (toTier) {
          const toRank = getWorkspacePlan(toTier)?.rank ?? 0
          setSuccessScenario(
            toRank > currentRank
              ? { type: "upgrade", fromTier: currentTier, toTier }
              : { type: "downgrade", fromTier: currentTier, toTier }
          )
        }
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      toast.error("Failed to update plan. Please try again.")
    } catch {
      toast.error("Failed to update plan. Please try again.")
    } finally {
      setLoadingVariantId(null)
    }
  }

  if (!workspaceBillingEnabled) {
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
                  {defaultPlan?.name ?? "Free"}
                </h3>
                <p className="mt-1.5 text-sm leading-snug text-muted-foreground sm:min-h-[34px]">
                  {defaultPlan?.description ?? ""}
                </p>
              </div>

              <div className="mb-4 flex items-end gap-1.5 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {defaultPlan?.priceLabel ?? "$0"}
                <span className="pb-1 text-xs leading-tight font-medium text-muted-foreground sm:text-sm">
                  <T>per workspace</T>
                </span>
              </div>

              <ul className="mb-5 flex-1 space-y-2.5">
                {(defaultPlan?.highlights ?? []).map((highlight, index) => (
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
    )
  }

  return (
    <>
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
                  anytime as you grow. All paid plans are billed per workspace
                  per month.
                </T>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-4 py-5 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-6">
            {plans.map((plan) => {
              const tierId = plan.tierId
              const isCurrent = tierId === currentTier
              const isMostPopular = plan.mostPopular
              const isHighlighted = tierId === highlightedTierId
              const showMostPopularBadge =
                isMostPopular && !isCurrent && !isCurrentTierAboveMostPopular
              const isFree = !plan.lemonSqueezyVariantId
              const isPreSelected =
                initialTier !== undefined &&
                tierId === initialTier &&
                !isCurrent
              const isLoadingThisPlan =
                !isFree &&
                plan.lemonSqueezyVariantId !== null &&
                loadingVariantId === plan.lemonSqueezyVariantId
              const isAnyLoading = loadingVariantId !== null
              const ctaLabel = getPlanCtaLabel(
                plan.rank,
                currentRank,
                isCurrent
              )

              return (
                <div
                  key={tierId}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-background p-4 shadow-sm transition-all duration-200 hover:shadow-md sm:p-5",
                    isHighlighted
                      ? "z-10 mt-3 border-primary/40 bg-linear-to-b from-background to-primary/2 ring-1 shadow-primary/5 ring-primary/5 sm:mt-0 sm:scale-[1.02]"
                      : "border-border/70",
                    isCurrent && !isHighlighted
                      ? "border-border bg-muted/20"
                      : "",
                    isPreSelected ? "ring-2 shadow-primary/20 ring-primary" : ""
                  )}
                >
                  {(isCurrent || showMostPopularBadge) && (
                    <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 sm:flex-row">
                      {isCurrent ? (
                        <Badge className="h-auto rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm hover:bg-emerald-600">
                          <T>Current Plan</T>
                        </Badge>
                      ) : null}
                      {showMostPopularBadge ? (
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
                      {plan.description}
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
                            isHighlighted
                              ? "text-primary"
                              : "text-muted-foreground/60"
                          )}
                        />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>

                  {isFree ? null : isCurrent ? (
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="mt-auto w-full rounded-xl border-foreground/10 font-semibold text-foreground/70"
                    >
                      <Link
                        href={
                          currentPlan?.manageUrl ??
                          "https://store.trackables.org/billing"
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => onOpenChange(false)}
                      >
                        {ctaLabel}
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      variant={isHighlighted ? "default" : "secondary"}
                      className={cn(
                        "mt-auto w-full rounded-xl font-semibold transition-transform active:scale-[0.98]",
                        isHighlighted
                          ? "bg-primary shadow-md hover:bg-primary/90 hover:shadow-lg"
                          : ""
                      )}
                      disabled={isAnyLoading || !plan.lemonSqueezyVariantId}
                      onClick={() =>
                        plan.lemonSqueezyVariantId &&
                        handleCheckout(plan.lemonSqueezyVariantId)
                      }
                    >
                      {isLoadingThisPlan ? (
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                      ) : isHighlighted ? (
                        <SparklesIcon className="mr-2 size-4 fill-primary-foreground/30" />
                      ) : null}
                      {ctaLabel}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {successScenario && (
        <BillingSuccessModal
          open={!!successScenario}
          onOpenChange={(open) => {
            if (!open) setSuccessScenario(null)
          }}
          scenario={successScenario}
        />
      )}
    </>
  )
}
