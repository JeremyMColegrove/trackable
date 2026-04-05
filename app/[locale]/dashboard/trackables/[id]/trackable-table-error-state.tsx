"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { CircleAlert, LoaderCircle, RefreshCw } from "lucide-react"

export function TrackableTableErrorState({
  title,
  description,
  actionLabel,
  onAction,
  isActionPending = false,
}: {
  title: React.ReactNode
  description: React.ReactNode
  actionLabel: React.ReactNode
  onAction: () => void
  isActionPending?: boolean
}) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" />
        </div>
        <div className="max-w-md space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onAction}
          disabled={isActionPending}
        >
          {isActionPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
