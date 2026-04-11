import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { AuthPageShell } from "@/components/auth/auth-page-shell"

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
    <AuthPageShell>
      <SignUpPageEntry redirectUrl={redirectUrl} />
    </AuthPageShell>
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
