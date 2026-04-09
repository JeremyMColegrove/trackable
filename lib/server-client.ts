import "server-only"

import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client"
import { createAuthClient } from "better-auth/client"
import type { Auth } from "better-auth"

import { auth } from "@/server/auth"

const authUrl =
  process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""

export const serverClient = createAuthClient({
  baseURL: authUrl,
  plugins: [oauthProviderResourceClient(auth as unknown as Auth)],
})
