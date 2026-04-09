import type { Metadata } from "next"
import { Suspense } from "react"
import { createNoIndexMetadata } from "@/lib/seo"
import { ConsentClient } from "./consent-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Authorize access",
  description: "Review and approve access to your Trackables account.",
})

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={null}>
      <div className="flex min-h-svh items-center justify-center px-4 py-10">
        <ConsentClient />
      </div>
    </Suspense>
  )
}
