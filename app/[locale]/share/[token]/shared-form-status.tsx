/** biome-ignore-all lint/correctness/useUniqueElementIds: <explanation> */
/** biome-ignore-all lint/a11y/noLabelWithoutControl: <explanation> */
"use client"

import { StatusPageCard } from "@/components/status-page-card"
import { Skeleton } from "@/components/ui/skeleton"
import { T } from "gt-next"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export function SharedFormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 md:px-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  )
}

export function SharedFormUnavailable({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <StatusPageCard
      badge={<T>Shared form</T>}
      title={title}
      description={description}
      align="start"
    >
      {children}
    </StatusPageCard>
  )
}

export function SharedFormStatusCard({
  badge,
  title,
  description,
  variant = "success",
}: {
  badge: string
  title: string
  description: string
  variant?: "success" | "error"
}) {
  const Icon = variant === "error" ? AlertCircle : CheckCircle2

  return (
    <StatusPageCard
      badge={badge}
      title={title}
      description={description}
      icon={Icon}
      variant={variant}
    />
  )
}

export function SharedFormResponseLimitCard() {
  return (
    <SharedFormStatusCard
      badge="Response limit reached"
      title="This survey is no longer accepting responses."
      description="This survey has already received the maximum number of responses allowed on the current plan. The workspace owner needs to upgrade to accept more responses."
      variant="error"
    />
  )
}
