import { clerkClient } from "@clerk/nextjs/server"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { users } from "@/db/schema"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import {
  createWorkspaceForUser,
  getWorkspaceMemberships,
  resolveActiveWorkspace,
} from "@/server/workspaces"

export const accountRouter = createTRPCRouter({
  getProfilePrivacy: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        isProfilePrivate: true,
      },
    })

    return {
      isProfilePrivate: user?.isProfilePrivate ?? false,
    }
  }),

  getWorkspaceContext: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    const [activeMembership, memberships] = await Promise.all([
      resolveActiveWorkspace(userId),
      getWorkspaceMemberships(userId),
    ])

    return {
      activeWorkspace: {
        id: activeMembership.workspace.id,
        name: activeMembership.workspace.name,
        slug: activeMembership.workspace.slug,
        role: activeMembership.role,
      },
      workspaces: memberships.map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
      })),
    }
  }),

  switchWorkspace: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const memberships = await getWorkspaceMemberships(userId)
      const nextMembership = memberships.find(
        (membership) => membership.workspaceId === input.workspaceId
      )

      if (!nextMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found.",
        })
      }

      await db
        .update(users)
        .set({
          activeWorkspaceId: input.workspaceId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))

      return {
        ok: true,
      }
    }),

  createWorkspace: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, { message: "Workspace name is required." })
          .max(80, { message: "Workspace name must be 80 characters or fewer." }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const workspace = await createWorkspaceForUser({
        userId,
        name: input.name,
      })

      return workspace
    }),

  updateProfilePrivacy: protectedProcedure
    .input(
      z.object({
        isProfilePrivate: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const clerk = await clerkClient()
      const clerkUser = await clerk.users.getUser(userId)

      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...(clerkUser.publicMetadata ?? {}),
          isProfilePrivate: input.isProfilePrivate,
        },
      })

      await db
        .update(users)
        .set({
          isProfilePrivate: input.isProfilePrivate,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))

      return {
        isProfilePrivate: input.isProfilePrivate,
      }
    }),
})
