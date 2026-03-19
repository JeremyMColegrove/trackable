export type DashboardNavItem = {
  href: string
  label: string
}

export const dashboardNavItems: DashboardNavItem[] = []

export function isDashboardNavItemActive(href: string, pathname: string) {
  if (href === "/dashboard") {
    return pathname === href || pathname.startsWith("/dashboard/trackables/")
  }

  return pathname === href
}
