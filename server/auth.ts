// import "server-only";

import { oauthProvider } from "@better-auth/oauth-provider"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { haveIBeenPwned, jwt, lastLoginMethod } from "better-auth/plugins"

import { db } from "@/db"
import {
  account,
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
  verification,
} from "@/db/schema/auth"
import { buildAuthEmailSettings } from "@/server/auth-email"
import {
  provisionNewAuthUser,
  syncAuthUserProfile,
} from "@/server/user-provisioning"
import { getAppOrigin, getMcpResourceUrl } from "@/lib/mcp-oauth"

const AUTH_RECOVERY_PATH = "/auth/recovery"
const appOrigin = getAppOrigin()

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      oauthClient,
      oauthAccessToken,
      oauthRefreshToken,
      oauthConsent,
      jwks,
    },
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (authUser) => {
          await provisionNewAuthUser(authUser)
        },
      },
      update: {
        after: async (authUser) => {
          await syncAuthUserProfile(authUser)
        },
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: appOrigin,
  basePath: "/api/auth",
  onAPIError: appOrigin
    ? {
        errorURL: `${appOrigin}${AUTH_RECOVERY_PATH}`,
      }
    : undefined,
  ...buildAuthEmailSettings(),
  socialProviders: {
    microsoft: process.env.MICROSOFT_CLIENT_ID
      ? {
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          tenantId: process.env.MICROSOFT_TENANT_ID,
        }
      : undefined,
  },
  account: {
    accountLinking: {
      enabled: true,
      allowUnlinkingAll: true,
      updateUserInfoOnLink: true,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min cache to reduce DB reads
    },
  },
  plugins: [
    jwt({
      jwt: {
        // Explicitly pin the issuer to baseURL (without basePath) so that
        // both token issuance (iss claim) and oauthProviderResourceClient
        // verification use the same value. Without this, better-auth defaults
        // the iss to ctx.context.baseURL which includes /api/auth, causing a
        // JWTClaimValidationFailed "unexpected iss claim value" on MCP token verify.
        issuer: appOrigin,
      },
    }), // required peer for oauthProvider
    haveIBeenPwned(),
    lastLoginMethod({
      storeInDatabase: true,
    }),
    oauthProvider({
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      loginPage: "/sign-in",
      consentPage: "/oauth/consent",
      validAudiences: [getMcpResourceUrl()],
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
