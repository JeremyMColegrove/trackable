"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { createTRPCClient } from "@trpc/client"
import { useState } from "react"

import type { AppRouter } from "@/server/api/root"
import { getSiteUrl } from "@/lib/site-config"
import { getQueryClient } from "@/trpc/query-client"
import { TRPCProvider } from "@/trpc/client"

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return ""
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return getSiteUrl().toString().replace(/\/$/, "")
}

export function TRPCReactProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
