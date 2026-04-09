"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"

export function RequireAuth({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { data: session, isPending } = useSession()
  const isLoaded = !isPending
  const userId = session?.user?.id ?? null
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded || userId) {
      return
    }

    router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`)
  }, [isLoaded, pathname, router, userId])

  if (!isLoaded || !userId) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
