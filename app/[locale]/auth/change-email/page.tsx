import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { createNoIndexMetadata } from "@/lib/seo"

import {
  ChangeEmailCardSkeleton,
  ChangeEmailPageClient,
} from "./change-email-page-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Email change",
  description: "Finish changing the email address on your Trackables account.",
})

export default function ChangeEmailPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={<ChangeEmailCardSkeleton />}>
        <ChangeEmailPageClient />
      </Suspense>
    </AuthPageShell>
  )
}
