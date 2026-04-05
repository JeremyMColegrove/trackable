"use client"

import { useLocale, useGT } from "gt-next"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserAccountButton } from "@/components/user-account-button"

function getDashboardBreadcrumbLabel({
  pathname,
  dashboardBaseHref,
  gt,
}: {
  pathname: string
  dashboardBaseHref: string
  gt: (value: string) => string
}) {
  if (pathname.startsWith(`${dashboardBaseHref}/team`)) {
    return gt("Team")
  }

  if (pathname.startsWith(`${dashboardBaseHref}/internal/batch`)) {
    return gt("Batch Jobs")
  }

  return gt("Overview")
}

function isTopLevelDashboardPage({
  pathname,
  dashboardBaseHref,
}: {
  pathname: string
  dashboardBaseHref: string
}) {
  return (
    pathname === dashboardBaseHref ||
    pathname === `${dashboardBaseHref}/team` ||
    pathname.startsWith(`${dashboardBaseHref}/internal/batch`)
  )
}

export function DashboardHeader() {
  const gt = useGT()
  const locale = useLocale()
  const pathname = usePathname()
  const dashboardBaseHref =
    locale === "en" ? "/dashboard" : `/${locale}/dashboard`
  const overviewLabel = gt("Overview")
  const breadcrumbLabel = getDashboardBreadcrumbLabel({
    pathname,
    dashboardBaseHref,
    gt,
  })
  const showSingleCrumb = isTopLevelDashboardPage({
    pathname,
    dashboardBaseHref,
  })

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="flex h-15 w-full items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <nav
            aria-label={gt("Breadcrumb")}
            className="flex min-w-0 items-center gap-2 text-sm"
          >
            {showSingleCrumb ? (
              <span className="truncate font-semibold">{breadcrumbLabel}</span>
            ) : (
              <>
                <Link
                  href={dashboardBaseHref}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {overviewLabel}
                </Link>
                <span className="shrink-0 text-muted-foreground">/</span>
                <span className="truncate font-semibold">
                  {breadcrumbLabel}
                </span>
              </>
            )}
          </nav>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <UserAccountButton />
        </div>
      </div>
    </header>
  )
}
