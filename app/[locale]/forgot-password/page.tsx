import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { getPublicAppConfig } from "@/lib/public-app-config"
import { createNoIndexMetadata } from "@/lib/seo"
import { ForgotPasswordClient } from "./forgot-password-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Forgot password",
  description: "Reset your Trackables account password.",
})

async function ForgotPasswordPageContent() {
  await connection()
  const { authEmailServiceEnabled } = getPublicAppConfig()

  return (
    <AuthPageShell>
      <ForgotPasswordClient authEmailServiceEnabled={authEmailServiceEnabled} />
    </AuthPageShell>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageContent />
    </Suspense>
  )
}
