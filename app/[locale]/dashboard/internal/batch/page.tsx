import { getAuth } from "@/server/get-auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import {
  BatchJobsPageClient,
  BatchJobsPageSkeleton,
} from "@/app/[locale]/dashboard/internal/batch/page-client"
import { hasAdminControlsEnabled } from "@/server/admin-controls"
import { ensureUserProvisioned } from "@/server/user-provisioning"

async function BatchJobsPageContent() {
  const { userId } = await getAuth()

  if (userId) {
    await ensureUserProvisioned(userId)

    if (!(await hasAdminControlsEnabled(userId))) {
      redirect("/dashboard")
    }
  }

  return <BatchJobsPageClient />
}

export default function BatchJobsPage() {
  return (
    <Suspense fallback={<BatchJobsPageSkeleton />}>
      <BatchJobsPageContent />
    </Suspense>
  )
}
