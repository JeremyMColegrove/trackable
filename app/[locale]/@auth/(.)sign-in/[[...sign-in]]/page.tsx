import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthModal } from "@/components/auth/auth-modal"
import { createNoIndexMetadata } from "@/lib/seo"
import { SignInPageEntry } from "../../../sign-in/[[...sign-in]]/sign-in-page-entry"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Sign in",
  description:
    "Sign in to manage forms, responses, and API usage in Trackables.",
})

export default function InterceptedSignInPage() {
  return (
    <Suspense fallback={null}>
      <AuthModal>
        <SignInPageEntry redirectUrl="/dashboard" />
      </AuthModal>
    </Suspense>
  )
}
