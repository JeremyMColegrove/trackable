"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { T } from "gt-next"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { signOut, useSession } from "@/lib/auth-client"

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() ?? ""
}

function EmailChangeCard({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
      {children}
    </div>
  )
}

export function ChangeEmailCardSkeleton() {
  return (
    <EmailChangeCard>
      <Skeleton className="mx-auto h-7 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-10 w-full" />
    </EmailChangeCard>
  )
}

export function ChangeEmailPageClient() {
  const searchParams = useSearchParams()
  const { data: session, isPending } = useSession()
  const hasSignedOut = useRef(false)

  const nextEmail = normalizeEmail(searchParams.get("newEmail"))
  const isComplete = searchParams.get("complete") === "1"

  useEffect(() => {
    if (!isComplete || !session || hasSignedOut.current) {
      return
    }

    hasSignedOut.current = true
    void signOut()
  }, [isComplete, session])

  if (isComplete && isPending) {
    return <ChangeEmailCardSkeleton />
  }

  if (!nextEmail) {
    return (
      <EmailChangeCard>
        <h1 className="text-xl font-semibold">
          <T>Email change</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>We couldn&apos;t find an email change to finish.</T>
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">
            <T>Go to dashboard</T>
          </Link>
        </Button>
      </EmailChangeCard>
    )
  }

  if (!isComplete) {
    return (
      <EmailChangeCard>
        <h1 className="text-xl font-semibold">
          <T>Email change</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>This link is no longer valid.</T>
        </p>
      </EmailChangeCard>
    )
  }

  const signInHref = nextEmail
    ? `/sign-in?email=${encodeURIComponent(nextEmail)}`
    : "/sign-in"

  return (
    <EmailChangeCard>
      <h1 className="text-xl font-semibold">
        <T>Email updated</T>
      </h1>
      <p className="text-sm text-muted-foreground">
        <T>Your email has been changed to </T>
        <strong>{nextEmail}</strong>
        <T>.</T>
      </p>
      <Button asChild className="w-full">
        <Link href={signInHref}>
          <T>Sign in again</T>
        </Link>
      </Button>
    </EmailChangeCard>
  )
}
