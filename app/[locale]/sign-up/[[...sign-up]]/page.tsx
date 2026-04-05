import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { AuthModal } from "@/components/auth/auth-modal"
import { createNoIndexMetadata } from "@/lib/seo"

import { LandingPage } from "../../landing-page"
import { SignUpPageEntry } from "./sign-up-page-entry"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Create account",
  description:
    "Create a Trackables account to manage forms, responses, and API usage.",
})

function resolveRedirectUrl(redirectUrl: string | string[] | undefined) {
  return typeof redirectUrl === "string" && redirectUrl.length > 0
    ? redirectUrl
    : "/dashboard"
}

async function SignUpPageContent({
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
        <SignUpPageEntry redirectUrl={redirectUrl} />
      </AuthModal>
    </>
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
