import type { Metadata } from "next"

import { createNoIndexMetadata } from "@/lib/seo"

import { DashboardShell } from "./dashboard-shell"
import { WorkspaceContextProvider } from "./workspace-context-provider"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Dashboard",
  description: "Authenticated dashboard for managing trackables.",
})

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WorkspaceContextProvider>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceContextProvider>
  )
}
