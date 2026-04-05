import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { AuthModal } from "@/components/auth/auth-modal"
import { createNoIndexMetadata } from "@/lib/seo"

import { LandingPage } from "../../landing-page"
import { SignInPageEntry } from "./sign-in-page-entry"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Sign in",
  description:
    "Sign in to manage forms, responses, and API usage in Trackables.",
})

function resolveRedirectUrl(redirectUrl: string | string[] | undefined) {
  return typeof redirectUrl === "string" && redirectUrl.length > 0
    ? redirectUrl
    : "/dashboard"
}

async function SignInPageContent({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>
}) {
  await connection()
  const { redirect_url } = await searchParams
  const redirectUrl = resolveRedirectUrl(redirect_url)

  return (
    <>
      <LandingPage />
      <AuthModal>
        <SignInPageEntry redirectUrl={redirectUrl} />
      </AuthModal>
    </>
  )
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>
}) {
  return (
    <Suspense fallback={null}>
      <SignInPageContent searchParams={searchParams} />
    </Suspense>
  )
}
