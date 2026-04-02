import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type StatusPageCardProps = {
  badge?: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  children?: React.ReactNode
  icon?: LucideIcon
  variant?: "default" | "success" | "error"
  align?: "start" | "center"
  containerClassName?: string
  cardClassName?: string
}

const variantClassNames = {
  default: "bg-muted text-foreground",
  success: "bg-emerald-500/10 text-emerald-600",
  error: "bg-destructive/10 text-destructive",
} satisfies Record<NonNullable<StatusPageCardProps["variant"]>, string>

export function StatusPageCard({
  badge,
  title,
  description,
  children,
  icon: Icon,
  variant = "default",
  align = "center",
  containerClassName,
  cardClassName,
}: StatusPageCardProps) {
  const isCentered = align === "center"

  return (
    <div
      className={cn(
        "mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-10 md:px-6",
        containerClassName
      )}
    >
      <Card
        className={cn(
          "w-full rounded-3xl border-border/60 bg-card/95 shadow-sm",
          cardClassName
        )}
      >
        <CardContent
          className={cn(
            "px-6 py-12",
            isCentered
              ? "flex flex-col items-center gap-4 text-center"
              : "space-y-3"
          )}
        >
          {Icon ? (
            <div
              className={cn("rounded-full p-3", variantClassNames[variant])}
            >
              <Icon className="size-8" />
            </div>
          ) : null}
          {badge ? (
            <Badge
              variant="outline"
              className={cn(
                "px-3 py-1",
                isCentered ? "rounded-full" : "w-fit rounded-full"
              )}
            >
              {badge}
            </Badge>
          ) : null}
          <div
            className={cn(
              "space-y-3",
              isCentered ? "flex max-w-xl flex-col items-center" : "max-w-xl"
            )}
          >
            <h1
              className={cn(
                "font-semibold tracking-tight",
                isCentered ? "text-3xl" : "text-2xl"
              )}
            >
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children ? (
            <div className={cn(isCentered ? "pt-2" : "pt-1")}>{children}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
