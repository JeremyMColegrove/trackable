"use client"

import { useLocale } from "gt-next"
import { usePathname } from "next/navigation"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { DashboardHeader } from "./DashboardHeader"
import { DashboardSidebar } from "./DashboardSidebar"

export function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = useLocale()
  const pathname = usePathname()
  const localizedDashboardPrefix = `/${locale}/dashboard/trackables/`
  const isTrackableRoute =
    pathname.startsWith("/dashboard/trackables/") ||
    pathname.startsWith(localizedDashboardPrefix)

  if (isTrackableRoute) {
    return <>{children}</>
  }

  return (
    <SidebarProvider defaultOpen={true} className="bg-background">
      <DashboardSidebar />
      <SidebarInset className="min-h-svh min-w-0 bg-background">
        <DashboardHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
