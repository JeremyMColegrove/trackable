"use client"

import { Badge } from "./badge"

export function formatLimitUsage(current: number, limit: number) {
  return `${current}/${limit}`
}

export function LimitUsageBadge({
  current,
  limit,
  className,
}: {
  current: number
  limit: number
  className?: string
}) {
  return (
    <Badge variant="outline" className="mx-2">
      {formatLimitUsage(current, limit)}
    </Badge>
  )
}
