"use client"

import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Microsoft } from "@/icons/microsoft"
import {
  getAuthRedirectQuery,
  resolveSafeAuthRedirectPath,
} from "@/lib/auth-redirect"
import { signIn } from "@/lib/auth-client"
import { T } from "gt-next"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function SignInPageClient({
  authEmailServiceEnabled,
  redirectUrl,
  showMicrosoftSignIn,
}: {
  authEmailServiceEnabled: boolean
  redirectUrl: string
  showMicrosoftSignIn: boolean
}) {
  const router = useRouter()
  const safeRedirectUrl = resolveSafeAuthRedirectPath(redirectUrl)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isMicrosoftPending, setIsMicrosoftPending] = useState(false)

  async function handleEmailSignIn(e: { preventDefault(): void }) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const result = await signIn.email({
      email,
      password,
      callbackURL: safeRedirectUrl,
    })

    if (result.error) {
      setError(result.error.message ?? "Sign in failed. Please try again.")
      setIsPending(false)
      return
    }

    router.push(safeRedirectUrl)
  }

  async function handleMicrosoftSignIn() {
    setIsMicrosoftPending(true)
    await signIn.social({
      provider: "microsoft",
      callbackURL: safeRedirectUrl,
    })
  }

  return (
    <>
      <RedirectIfSignedIn href={safeRedirectUrl} />
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            <T>Sign in</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Enter your credentials to continue</T>
          </p>
        </div>

        {showMicrosoftSignIn ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleMicrosoftSignIn}
              disabled={isMicrosoftPending || isPending}
            >
              {isMicrosoftPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Microsoft className="mr-2 size-4" />
              )}
              <T>Continue with Microsoft</T>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  <T>Or continue with email</T>
                </span>
              </div>
            </div>
          </>
        ) : null}

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sign-in-email">
              <T>Email</T>
            </Label>
            <Input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending || isMicrosoftPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sign-in-password">
              <T>Password</T>
            </Label>
            <Input
              id="sign-in-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending || isMicrosoftPending}
            />
            {authEmailServiceEnabled ? (
              <div className="text-right">
                <a
                  href="/forgot-password"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  <T>Forgot password?</T>
                </a>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || isMicrosoftPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            <T>Sign in</T>
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <T>Don't have an account?</T>{" "}
          <a
            href={`/sign-up${getAuthRedirectQuery(safeRedirectUrl)}`}
            className="underline-offset-4 hover:underline"
          >
            <T>Sign up</T>
          </a>
        </p>
      </div>
    </>
  )
}
