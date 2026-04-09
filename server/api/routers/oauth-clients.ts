import { createHash } from "node:crypto"

import { TRPCError } from "@trpc/server"
import { headers } from "next/headers"
import { z } from "zod"

import { logger } from "@/lib/logger"
import { hasAdminControlsEnabled } from "@/server/admin-controls"
import {
  createTRPCRouter,
  getRequiredUserId,
  protectedProcedure,
} from "@/server/api/trpc"
import { auth } from "@/server/auth"

async function requireAdmin(userId: string) {
  if (!(await hasAdminControlsEnabled(userId))) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
}

function summarizeSecret(secret: string) {
  return {
    length: secret.length,
    sha256Prefix: createHash("sha256").update(secret).digest("hex").slice(0, 12),
    hasLeadingOrTrailingWhitespace: secret.trim() !== secret,
  }
}

export const oauthClientsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    await requireAdmin(getRequiredUserId(ctx))

    const clients = await auth.api.getOAuthClients({
      headers: await headers(),
    })

    return clients ?? []
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        redirectUri: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(getRequiredUserId(ctx))

      const result = await auth.api.adminCreateOAuthClient({
        headers: await headers(),
        body: {
          client_name: input.name,
          redirect_uris: [input.redirectUri],
          grant_types: ["authorization_code"],
          token_endpoint_auth_method: "client_secret_post",
        },
      })

      if (!result.client_secret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Better Auth did not return a client secret for the new OAuth client.",
        })
      }

      logger.info(
        {
          clientId: result.client_id,
          redirectUris: result.redirect_uris,
          tokenEndpointAuthMethod: result.token_endpoint_auth_method,
          clientSecret: summarizeSecret(result.client_secret),
        },
        "OAuth client created"
      )

      return result
    }),

  rotate: protectedProcedure
    .input(z.object({ clientId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(getRequiredUserId(ctx))

      const result = await auth.api.rotateClientSecret({
        headers: await headers(),
        body: { client_id: input.clientId },
      })

      if (!result.client_secret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Better Auth did not return a client secret for the rotated OAuth client.",
        })
      }

      logger.info(
        {
          clientId: input.clientId,
          tokenEndpointAuthMethod: result.token_endpoint_auth_method,
          clientSecret: summarizeSecret(result.client_secret),
        },
        "OAuth client secret rotated"
      )

      return result
    }),

  revoke: protectedProcedure
    .input(z.object({ clientId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(getRequiredUserId(ctx))

      await auth.api.deleteOAuthClient({
        headers: await headers(),
        body: { client_id: input.clientId },
      })
    }),
})
