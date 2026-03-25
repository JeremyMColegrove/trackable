import type { Metadata } from "next"

import { AuthModal } from "@/components/auth/auth-modal"
import { createNoIndexMetadata } from "@/lib/seo"

import { LandingPage } from "../../landing-page"
import { SignUpPageClient } from "./sign-up-page-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Create account",
  description:
    "Create a Trackables account to manage forms, responses, and API usage.",
})

export default function SignUpPage() {
  return (
    <>
      <LandingPage />
      <AuthModal>
        <SignUpPageClient />
      </AuthModal>
    </>
  )
}
