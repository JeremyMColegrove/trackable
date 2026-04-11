"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { T, useGT } from "gt-next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  resolveSafeAuthRedirectPath,
} from "@/lib/auth-redirect"

const AUTH_RECOVERY_PATH = "/auth/recovery"

function buildMicrosoftRecoveryUrl(redirectUrl: string) {
  const safeRedirectUrl = resolveSafeAuthRedirectPath(redirectUrl)

  if (safeRedirectUrl === DEFAULT_AUTH_REDIRECT_PATH) {
    return `${AUTH_RECOVERY_PATH}?provider=microsoft`
  }

  return `${AUTH_RECOVERY_PATH}?provider=microsoft&redirect_url=${encodeURIComponent(safeRedirectUrl)}`
}

type RecoveryPageClientProps = {
  error: string | null
  errorDescription: string | null
  initialIsSignedIn: boolean
  provider: string | null
  redirectUrl: string
  shouldOfferAccountLink: boolean
  signInHref: string
}

export function RecoveryPageClient({
  error,
  errorDescription,
  initialIsSignedIn,
  provider,
  redirectUrl,
  shouldOfferAccountLink,
  signInHref,
}: RecoveryPageClientProps) {
  const gt = useGT()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(initialIsSignedIn)

  async function startLinkFlow() {
    if (provider !== "microsoft") {
      setInlineError(gt("We couldn't determine which provider to link."))
      setIsPending(false)
      return
    }

    const result = await authClient.linkSocial({
      provider: "microsoft",
      callbackURL: redirectUrl,
      errorCallbackURL: buildMicrosoftRecoveryUrl(redirectUrl),
    })

    if (result.error) {
      setInlineError(result.error.message ?? gt("Unable to link this account."))
      setIsPending(false)
    }
  }

  async function handleLinkSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInlineError(null)
    setIsPending(true)

    const signInResult = await authClient.signIn.email({
      email,
      password,
    })

    if (signInResult.error) {
      setInlineError(
        signInResult.error.message ?? gt("Sign in failed. Please try again.")
      )
      setIsPending(false)
      return
    }

    setIsSignedIn(true)
    await startLinkFlow()
  }

  async function handleLinkClick() {
    setInlineError(null)
    setIsPending(true)
    await startLinkFlow()
  }

  if (!shouldOfferAccountLink) {
    return (
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            <T>Sign-in issue</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            {error === "email_doesn't_match" ? (
              <T>
                This social account uses a different email address than your
                existing account.
              </T>
            ) : error === "account_already_linked_to_different_user" ? (
              <T>
                This social account is already linked to another Trackables
                user.
              </T>
            ) : (
              <T>
                We couldn&apos;t complete your sign-in. Try again or continue
                with email and password.
              </T>
            )}
          </p>
          {errorDescription ? (
            <p className="text-sm text-muted-foreground">{errorDescription}</p>
          ) : null}
        </div>

        <Button asChild className="w-full">
          <Link href={signInHref}>
            <T>Continue with email</T>
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          <T>Link your Microsoft account</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignedIn
            ? (
              <T>
                You&apos;re already signed in. Continue to link Microsoft to
                this Trackables account.
              </T>
            )
            : (
              <T>
                An account with this email already exists. Sign in with your
                password to link Microsoft and keep using the same Trackables
                account.
              </T>
            )}
        </p>
      </div>

      {isSignedIn ? (
        <Button
          type="button"
          className="w-full"
          disabled={isPending}
          onClick={handleLinkClick}
        >
          {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          <T>Continue with Microsoft</T>
        </Button>
      ) : (
        <form onSubmit={handleLinkSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovery-email">
              <T>Email</T>
            </Label>
            <Input
              id="recovery-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recovery-password">
              <T>Password</T>
            </Label>
            <Input
              id="recovery-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            <T>Link Microsoft</T>
          </Button>
        </form>
      )}

      {inlineError ? <p className="text-sm text-destructive">{inlineError}</p> : null}

      <p className="text-center text-sm text-muted-foreground">
        <Link href={signInHref} className="underline-offset-4 hover:underline">
          <T>Back to sign in</T>
        </Link>
      </p>
    </div>
  )
}
