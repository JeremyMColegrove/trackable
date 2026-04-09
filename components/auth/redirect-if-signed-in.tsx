"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { resolveSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { useSession } from "@/lib/auth-client"

export function RedirectIfSignedIn({ href }: { href: string }) {
  const { data: session, isPending } = useSession()
  const isLoaded = !isPending
  const userId = session?.user?.id ?? null
  const router = useRouter()
  const safeHref = resolveSafeAuthRedirectPath(href)

  useEffect(() => {
    if (!isLoaded || !userId) {
      return
    }

    router.replace(safeHref)
  }, [isLoaded, router, safeHref, userId])

  return null
}
