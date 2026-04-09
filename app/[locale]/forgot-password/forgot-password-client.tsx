"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { T } from "gt-next"
import { Loader2 } from "lucide-react"

export function ForgotPasswordClient({
  authEmailServiceEnabled,
}: {
  authEmailServiceEnabled: boolean
}) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    })

    if (result.error) {
      setError(
        result.error.message ?? "Failed to send reset email. Please try again."
      )
      setIsPending(false)
      return
    }

    setEmailSent(true)
    setIsPending(false)
  }

  if (!authEmailServiceEnabled) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">
          <T>Password reset unavailable</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>
            Password reset is disabled because auth email delivery is not
            enabled in this deployment.
          </T>
        </p>
        <p className="text-sm text-muted-foreground">
          <a href="/sign-in" className="underline-offset-4 hover:underline">
            <T>Back to sign in</T>
          </a>
        </p>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">
          <T>Check your email</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>We sent a password reset link to </T>
          <strong>{email}</strong>
          <T>. Click the link to reset your password.</T>
        </p>
        <p className="text-sm text-muted-foreground">
          <a href="/sign-in" className="underline-offset-4 hover:underline">
            <T>Back to sign in</T>
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          <T>Forgot your password?</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Enter your email and we will send you a reset link.</T>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="forgot-email">
            <T>Email</T>
          </Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          <T>Send reset link</T>
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <a href="/sign-in" className="underline-offset-4 hover:underline">
          <T>Back to sign in</T>
        </a>
      </p>
    </div>
  )
}
