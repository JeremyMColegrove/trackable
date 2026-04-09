"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { T } from "gt-next"
import { Loader2 } from "lucide-react"

export function ResetPasswordClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setError(null)
    setIsPending(true)

    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    })

    if (result.error) {
      setError(result.error.message ?? "Failed to reset password. Please try again.")
      setIsPending(false)
      return
    }

    setDone(true)
    setIsPending(false)
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold">
          <T>Invalid reset link</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>This password reset link is invalid or has expired.</T>
        </p>
        <p className="text-sm">
          <a href="/forgot-password" className="underline-offset-4 hover:underline">
            <T>Request a new link</T>
          </a>
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold">
          <T>Password reset</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Your password has been updated. You can now sign in.</T>
        </p>
        <p className="text-sm">
          <a href="/sign-in" className="underline-offset-4 hover:underline">
            <T>Sign in</T>
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          <T>Reset your password</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Enter a new password for your account.</T>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">
            <T>New password</T>
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">
            <T>Confirm password</T>
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isPending}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : null}
          <T>Reset password</T>
        </Button>
      </form>
    </div>
  )
}
