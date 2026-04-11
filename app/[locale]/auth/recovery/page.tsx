import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { AuthPageShell } from "@/components/auth/auth-page-shell"

import { getAuth } from "@/server/get-auth"
import {
  getAuthRedirectQuery,
  resolveSafeAuthRedirectPath,
} from "@/lib/auth-redirect"
import { createNoIndexMetadata } from "@/lib/seo"

import { RecoveryPageClient } from "./recovery-page-client"

export const metadata: Metadata = createNoIndexMetadata({
  title: "Account recovery",
  description: "Recover from sign-in issues and link your account safely.",
})

async function RecoveryPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()

  const [params, auth] = await Promise.all([searchParams, getAuth()])
  const error = typeof params.error === "string" ? params.error : null
  const errorDescription =
    typeof params.error_description === "string"
      ? params.error_description
      : null
  const provider = params.provider === "microsoft" ? "microsoft" : null
  const redirectUrl = resolveSafeAuthRedirectPath(params.redirect_url)
  const shouldOfferAccountLink =
    provider === "microsoft" &&
    (error === "account_not_linked" || error === "unable_to_link_account")

  return (
    <AuthPageShell>
      <RecoveryPageClient
        error={error}
        errorDescription={errorDescription}
        initialIsSignedIn={Boolean(auth.userId)}
        provider={provider}
        redirectUrl={redirectUrl}
        shouldOfferAccountLink={shouldOfferAccountLink}
        signInHref={`/sign-in${getAuthRedirectQuery(redirectUrl)}`}
      />
    </AuthPageShell>
  )
}

export default function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={null}>
      <RecoveryPageContent searchParams={searchParams} />
    </Suspense>
  )
}
