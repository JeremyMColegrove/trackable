"use client"

import { AppBrand } from "@/components/app-brand"
import { useIsMobile } from "@/hooks/use-mobile"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserAccountButton } from "@/components/user-account-button"

export function DashboardHeader() {
  const isMobile = useIsMobile()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 sm:px-8">
        <div className="flex items-center gap-6">
          {isMobile ? <SidebarTrigger /> : null}
          <AppBrand href="/" className="text-lg font-bold tracking-tighter" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-4 w-px bg-border max-sm:hidden" />
          <UserAccountButton />
        </div>
      </div>
    </header>
  )
}
