"use client"

import { usePathname } from "next/navigation"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { DashboardHeader } from "./DashboardHeader"
import { DashboardSidebar } from "./DashboardSidebar"

export function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isTrackableRoute = pathname.startsWith("/dashboard/trackables/")

  if (isTrackableRoute) {
    return <>{children}</>
  }

  return (
    <SidebarProvider defaultOpen={false} className="bg-background">
      <DashboardSidebar />
      <SidebarInset className="min-h-svh min-w-0 bg-background">
        <DashboardHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
