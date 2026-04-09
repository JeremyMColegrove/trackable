import "server-only"

import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider"

import { auth } from "@/server/auth"

export const GET = oauthProviderOpenIdConfigMetadata(auth)
