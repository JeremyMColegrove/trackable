"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { T, useGT } from "gt-next"
import { Loader2, Shield } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export function ConsentClient() {
  const searchParams = useSearchParams()
  const gt = useGT()
  const clientId = searchParams.get("client_id") ?? ""
  const scopeParam = searchParams.get("scope") ?? ""
  const scopes = scopeParam ? scopeParam.split(/[\s,]+/).filter(Boolean) : []

  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConsent(accept: boolean) {
    setIsPending(true)
    setError(null)

    try {
      const result = await authClient.oauth2.consent({ accept })

      if (result.error) {
        setError(result.error.message ?? gt("Something went wrong. Please try again."))
        setIsPending(false)
        return
      }

      if (result.data?.url) {
        window.location.href = result.data.url
      }
    } catch {
      setError(gt("Something went wrong. Please try again."))
      setIsPending(false)
    }
  }

  if (!clientId) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold">
          <T>Invalid request</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>This authorization request is invalid or has expired.</T>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-full bg-muted p-3">
          <Shield className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            <T>Authorize access</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{clientId}</strong>{" "}
            <T>is requesting access to your account.</T>
          </p>
        </div>
      </div>

      {scopes.length > 0 ? (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <T>Requested permissions</T>
          </p>
          <ul className="space-y-1">
            {scopes.map((scope) => (
              <li key={scope} className="text-sm text-foreground">
                {scope}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          disabled={isPending}
          onClick={() => handleConsent(true)}
        >
          {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          <T>Allow access</T>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isPending}
          onClick={() => handleConsent(false)}
        >
          <T>Deny</T>
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <T>
          You can revoke access at any time from your account settings.
        </T>
      </p>
    </div>
  )
}
