import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { AuthPageShell } from "@/components/auth/auth-page-shell"

import { resolveSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { createNoIndexMetadata } from "@/lib/seo"

import { SignInPageEntry } from "./sign-in-page-entry"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Sign in",
  description:
    "Sign in to manage forms, responses, and API usage in Trackables.",
})

async function SignInPageContent({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; redirect_url?: string | string[] }>
}) {
  await connection()
  const { email, redirect_url } = await searchParams
  const redirectUrl = resolveSafeAuthRedirectPath(redirect_url)
  const initialEmail = typeof email === "string" ? email : ""

  return (
    <AuthPageShell>
      <SignInPageEntry initialEmail={initialEmail} redirectUrl={redirectUrl} />
    </AuthPageShell>
  )
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; redirect_url?: string | string[] }>
}) {
  return (
    <Suspense fallback={null}>
      <SignInPageContent searchParams={searchParams} />
    </Suspense>
  )
}
