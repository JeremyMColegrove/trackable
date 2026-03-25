import type { Metadata } from "next"

import { AuthModal } from "@/components/auth/auth-modal"
import { createNoIndexMetadata } from "@/lib/seo"

import { LandingPage } from "../../landing-page"
import { SignInPageClient } from "./sign-in-page-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Sign in",
  description: "Sign in to manage forms, responses, and API usage in Trackables.",
})

export default function SignInPage() {
  return (
    <>
      <LandingPage />
      <AuthModal>
        <SignInPageClient />
      </AuthModal>
    </>
  )
}
