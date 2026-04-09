import { getAuth } from "@/server/get-auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { hasAdminControlsEnabled } from "@/server/admin-controls"
import { ensureUserProvisioned } from "@/server/user-provisioning"
import {
  OAuthClientsPageClient,
  OAuthClientsPageSkeleton,
} from "./page-client"

async function OAuthClientsPageContent() {
  const { userId } = await getAuth()

  if (userId) {
    await ensureUserProvisioned(userId)

    if (!(await hasAdminControlsEnabled(userId))) {
      redirect("/dashboard")
    }
  }

  return <OAuthClientsPageClient />
}

export default function OAuthClientsPage() {
  return (
    <Suspense fallback={<OAuthClientsPageSkeleton />}>
      <OAuthClientsPageContent />
    </Suspense>
  )
}
