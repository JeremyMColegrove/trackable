import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { createNoIndexMetadata } from "@/lib/seo"
import { ResetPasswordClient } from "./reset-password-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Reset password",
  description: "Set a new password for your Trackables account.",
})

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageShell>
        <ResetPasswordClient />
      </AuthPageShell>
    </Suspense>
  )
}
