import type { Metadata } from "next"
import { connection } from "next/server"
import Link from "next/link"
import { Suspense } from "react"
import { ChevronLeft } from "lucide-react"

import { resolveSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { createNoIndexMetadata } from "@/lib/seo"

import { SignUpPageEntry } from "./sign-up-page-entry"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Create account",
  description:
    "Create a Trackables account to manage forms, responses, and API usage.",
})

async function SignUpPageContent({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>
}) {
  await connection()
  const { redirect_url } = await searchParams
  const redirectUrl = resolveSafeAuthRedirectPath(redirect_url)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-gradient-to-b from-muted/50 via-background to-background px-4 py-10">
      <div className="mb-4 w-full max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Home
        </Link>
      </div>
      <SignUpPageEntry redirectUrl={redirectUrl} />
    </div>
  )
}

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>
}) {
  return (
    <Suspense fallback={null}>
      <SignUpPageContent searchParams={searchParams} />
    </Suspense>
  )
}
