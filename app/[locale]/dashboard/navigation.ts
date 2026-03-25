export type DashboardNavItem = {
  href: string
  label: string
}

export function getDashboardNavItems(
  hasAdminControls: boolean
): DashboardNavItem[] {
  return [
    {
      href: "/dashboard",
      label: "Overview",
    },
    {
      href: "/dashboard/team",
      label: "Team",
    },
    ...(hasAdminControls
      ? [
          {
            href: "/dashboard/internal/batch",
            label: "Batch Jobs",
          },
        ]
      : []),
  ]
}

export function isDashboardNavItemActive(href: string, pathname: string) {
  if (href === "/dashboard") {
    return pathname === href || pathname.startsWith("/dashboard/trackables/")
  }

  return pathname === href
}
