import type { Metadata } from "next"
import { Suspense } from "react"
import { createNoIndexMetadata } from "@/lib/seo"
import { LandingPage } from "../landing-page"
import { AuthModal } from "@/components/auth/auth-modal"
import { ResetPasswordClient } from "./reset-password-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Reset password",
  description: "Set a new password for your Trackables account.",
})

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <LandingPage />
      <AuthModal>
        <ResetPasswordClient />
      </AuthModal>
    </Suspense>
  )
}
