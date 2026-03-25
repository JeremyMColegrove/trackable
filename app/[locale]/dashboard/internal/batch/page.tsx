import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { BatchJobsPageClient } from "@/app/[locale]/dashboard/internal/batch/page-client"
import { hasAdminControlsEnabled } from "@/server/admin-controls"
import { ensureUserProvisioned } from "@/server/user-provisioning"

export default async function BatchJobsPage() {
  const { userId } = await auth()

  if (userId) {
    await ensureUserProvisioned(userId)

    if (!(await hasAdminControlsEnabled(userId))) {
      redirect("/dashboard")
    }
  }

  return <BatchJobsPageClient />
}
