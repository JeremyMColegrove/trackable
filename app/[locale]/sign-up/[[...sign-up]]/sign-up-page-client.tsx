"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp } from "@/lib/auth-client"
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getAuthRedirectQuery,
  resolveSafeAuthRedirectPath,
} from "@/lib/auth-redirect"
import { T } from "gt-next"
import { Loader2 } from "lucide-react"

export function SignUpPageClient({
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
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isMicrosoftPending, setIsMicrosoftPending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleEmailSignUp(e: { preventDefault(): void }) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const result = await signUp.email({
      name,
      email,
      password,
      callbackURL: safeRedirectUrl,
    })

    if (result.error) {
      setError(result.error.message ?? "Sign up failed. Please try again.")
      setIsPending(false)
      return
    }

    if (authEmailServiceEnabled) {
      setEmailSent(true)
    } else {
      router.push(safeRedirectUrl)
      router.refresh()
    }

    setIsPending(false)
  }

  async function handleMicrosoftSignIn() {
    setIsMicrosoftPending(true)
    await signIn.social({
      provider: "microsoft",
      callbackURL: safeRedirectUrl,
    })
  }

  if (emailSent) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">
          <T>Check your email</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>We sent a verification link to </T>
          <strong>{email}</strong>
          <T>. Click the link to activate your account.</T>
        </p>
      </div>
    )
  }

  return (
    <>
      <RedirectIfSignedIn href={safeRedirectUrl} />
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            <T>Create an account</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Enter your details to get started</T>
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
                <MicrosoftIcon className="mr-2 size-4" />
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

        <form onSubmit={handleEmailSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sign-up-name">
              <T>Full name</T>
            </Label>
            <Input
              id="sign-up-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending || isMicrosoftPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sign-up-email">
              <T>Email</T>
            </Label>
            <Input
              id="sign-up-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending || isMicrosoftPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sign-up-password">
              <T>Password</T>
            </Label>
            <Input
              id="sign-up-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending || isMicrosoftPending}
            />
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
            <T>Create account</T>
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <T>Already have an account?</T>{" "}
          <a
            href={`/sign-in${getAuthRedirectQuery(safeRedirectUrl)}`}
            className="underline-offset-4 hover:underline"
          >
            <T>Sign in</T>
          </a>
        </p>
      </div>
    </>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 21 21"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}
