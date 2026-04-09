import "server-only"

import { headers } from "next/headers"

import { auth } from "@/server/auth"

export async function getAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  return {
    userId: session?.user?.id ?? null,
    session: session ?? null,
    user: session?.user ?? null,
  }
}

export type AuthContext = Awaited<ReturnType<typeof getAuth>>
