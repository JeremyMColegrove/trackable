"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { T } from "gt-next"

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-gradient-to-b from-muted/50 via-background to-background px-4 py-10">
      <div className="mb-4 w-full max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          <T>Home</T>
        </Link>
      </div>

      {children}
    </div>
  )
}
