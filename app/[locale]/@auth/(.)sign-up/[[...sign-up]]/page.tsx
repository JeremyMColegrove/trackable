import type { Metadata } from "next"
import { Suspense } from "react"

import { createNoIndexMetadata } from "@/lib/seo"
import { SignUpModalShell } from "./sign-up-modal-shell"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Create account",
  description:
    "Create a Trackables account to manage forms, responses, and API usage.",
})

export default function InterceptedSignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpModalShell />
    </Suspense>
  )
}
