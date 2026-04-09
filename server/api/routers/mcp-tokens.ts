import { randomBytes, createHash } from "node:crypto"

import { TRPCError } from "@trpc/server"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { mcpAccessTokens, trackableItems } from "@/db/schema"
import {
  mcpTokenCapabilitiesSchema,
  normalizeMcpTokenCapabilities,
} from "@/lib/mcp-token-capabilities"
import {
  createTRPCRouter,
  getRequiredUserId,
  protectedProcedure,
} from "@/server/api/trpc"
import { getWorkspaceMemberships } from "@/server/workspaces"

async function getAccessibleCreationOptions(userId: string) {
  const memberships = await getWorkspaceMemberships(userId)
  const workspaceIds = memberships.map((membership) => membership.workspaceId)

  const trackables =
    workspaceIds.length === 0
      ? []
      : await db.query.trackableItems.findMany({
          where: and(
            inArray(trackableItems.workspaceId, workspaceIds),
            isNull(trackableItems.archivedAt)
          ),
          columns: {
            id: true,
            workspaceId: true,
            name: true,
            kind: true,
          },
          orderBy: [desc(trackableItems.createdAt)],
        })

  return {
    workspaces: memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    })),
    trackables,
  }
}

export const mcpTokensRouter = createTRPCRouter({
  getCreationOptions: protectedProcedure.query(async ({ ctx }) => {
    const userId = getRequiredUserId(ctx)
    return getAccessibleCreationOptions(userId)
  }),

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
        capabilities: mcpTokenCapabilitiesSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)
      const creationOptions = await getAccessibleCreationOptions(userId)

      // Generate token: trk_mcp_<32 chars base64url>
      const rawSuffix = randomBytes(24).toString("base64url").slice(0, 32)
      const rawToken = `trk_mcp_${rawSuffix}`

      const keyPrefix = rawToken.slice(0, 20)
      const secretHash = createHash("sha256").update(rawToken).digest("hex")
      const lastFour = rawToken.slice(-4)
      const capabilities = normalizeMcpTokenCapabilities(input.capabilities)
      const allowedWorkspaceIds = new Set(
        creationOptions.workspaces.map((workspace) => workspace.id)
      )
      const trackablesById = new Map(
        creationOptions.trackables.map((trackable) => [trackable.id, trackable])
      )

      for (const workspaceId of capabilities.workspaceIds ?? []) {
        if (!allowedWorkspaceIds.has(workspaceId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more selected workspaces are not accessible.",
          })
        }
      }

      for (const trackableId of capabilities.trackableIds ?? []) {
        const trackable = trackablesById.get(trackableId)

        if (!trackable) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more selected trackables are not accessible.",
          })
        }

        if (
          capabilities.workspaceIds &&
          !capabilities.workspaceIds.includes(trackable.workspaceId)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Trackable scope must stay within the selected workspace scope.",
          })
        }
      }

      await db.insert(mcpAccessTokens).values({
        createdByUserId: userId,
        name: input.name,
        keyPrefix,
        secretHash,
        lastFour,
        capabilities,
        status: "active",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })

      return { token: rawToken, name: input.name, capabilities }
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
