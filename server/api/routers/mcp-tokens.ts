import { randomBytes, createHash } from "node:crypto"

import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { mcpAccessTokens } from "@/db/schema"
import {
  createTRPCRouter,
  getRequiredUserId,
  protectedProcedure,
} from "@/server/api/trpc"

export const mcpTokensRouter = createTRPCRouter({
  listTokens: protectedProcedure.query(async ({ ctx }) => {
    const userId = getRequiredUserId(ctx)

    const tokens = await db.query.mcpAccessTokens.findMany({
      where: and(
        eq(mcpAccessTokens.createdByUserId, userId),
        eq(mcpAccessTokens.status, "active")
      ),
      columns: {
        id: true,
        name: true,
        lastFour: true,
        capabilities: true,
        expiresAt: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    })

    return tokens
  }),

  createToken: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, { message: "Name is required." })
          .max(100, { message: "Name must be 100 characters or fewer." }),
        expiresAt: z.string().datetime().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      // Generate token: trk_mcp_<32 chars base64url>
      const rawSuffix = randomBytes(24)
        .toString("base64url")
        .slice(0, 32)
      const rawToken = `trk_mcp_${rawSuffix}`

      const keyPrefix = rawToken.slice(0, 20)
      const secretHash = createHash("sha256").update(rawToken).digest("hex")
      const lastFour = rawToken.slice(-4)

      await db.insert(mcpAccessTokens).values({
        createdByUserId: userId,
        name: input.name,
        keyPrefix,
        secretHash,
        lastFour,
        capabilities: { tools: "all" },
        status: "active",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })

      return { token: rawToken, name: input.name }
    }),

  revokeToken: protectedProcedure
    .input(
      z.object({
        tokenId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      const token = await db.query.mcpAccessTokens.findFirst({
        where: and(
          eq(mcpAccessTokens.id, input.tokenId),
          eq(mcpAccessTokens.createdByUserId, userId)
        ),
        columns: { id: true },
      })

      if (!token) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Token not found." })
      }

      await db
        .update(mcpAccessTokens)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(mcpAccessTokens.id, input.tokenId))

      return { ok: true }
    }),
})
