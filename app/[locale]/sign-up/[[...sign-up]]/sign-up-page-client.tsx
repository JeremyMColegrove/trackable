"use client"

import { SignUp } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"

import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in"

export function SignUpPageClient() {
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect_url") ?? "/dashboard"

  return (
    <>
      <RedirectIfSignedIn href={redirectUrl} />
      <SignUp
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    </>
  )
}
