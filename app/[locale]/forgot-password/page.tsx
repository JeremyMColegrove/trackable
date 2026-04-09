import type { Metadata } from "next"
import { Suspense } from "react"
import { getPublicAppConfig } from "@/lib/public-app-config"
import { createNoIndexMetadata } from "@/lib/seo"
import { LandingPage } from "../landing-page"
import { AuthModal } from "@/components/auth/auth-modal"
import { ForgotPasswordClient } from "./forgot-password-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Forgot password",
  description: "Reset your Trackables account password.",
})

export default function ForgotPasswordPage() {
  const { authEmailServiceEnabled } = getPublicAppConfig()

  return (
    <Suspense fallback={null}>
      <LandingPage />
      <AuthModal>
        <ForgotPasswordClient
          authEmailServiceEnabled={authEmailServiceEnabled}
        />
      </AuthModal>
    </Suspense>
  )
}
