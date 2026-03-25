"use client"

import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type DateRangePopoverProps = {
  open: boolean
} & HTMLAttributes<HTMLDivElement>

export function DateRangePopover({
  children,
  className,
  open,
  ...props
}: DateRangePopoverProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className={cn(
        "absolute top-[calc(100%+0.375rem)] left-0 z-[80] min-w-full max-w-[min(90vw,30rem)] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
