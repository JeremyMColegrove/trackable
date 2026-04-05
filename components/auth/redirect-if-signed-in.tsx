"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"

export function RedirectIfSignedIn({ href }: { href: string }) {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded || !userId) {
      return
    }

    router.replace(href)
  }, [href, isLoaded, router, userId])

  return null
}
