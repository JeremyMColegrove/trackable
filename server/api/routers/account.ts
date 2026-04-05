import { clerkClient } from "@clerk/nextjs/server"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { users } from "@/db/schema"
import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement"
import { getFreeTierCreatedWorkspaceLimit } from "@/lib/subscription-plans"
import {
  createTRPCRouter,
  getRequiredUserId,
  protectedProcedure,
} from "@/server/api/trpc"
import { hasAdminControlsEnabled } from "@/server/admin-controls"
import { userActiveWorkspaceCache } from "@/server/redis/access-control-cache.repository"
import { subscriptionService } from "@/server/subscriptions/subscription-service.singleton"
import {
  createWorkspaceForUser,
  getCreatedWorkspaceCount,
  getWorkspaceMemberships,
} from "@/server/workspaces"
import { accessControlService } from "@/server/services/access-control.service"

export const accountRouter = createTRPCRouter({
  getProfilePrivacy: protectedProcedure.query(async ({ ctx }) => {
    const userId = getRequiredUserId(ctx)

    const [user, adminEnabled] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          isProfilePrivate: true,
        },
      }),
      hasAdminControlsEnabled(userId),
    ])

    return {
      hasAdminControls: adminEnabled,
      isProfilePrivate: user?.isProfilePrivate ?? false,
    }
  }),

  getWorkspaceContext: protectedProcedure.query(async ({ ctx }) => {
    const userId = getRequiredUserId(ctx)

    const [adminEnabled, activeMembership, memberships, createdWorkspaceCount] =
      await Promise.all([
        hasAdminControlsEnabled(userId),
        accessControlService.resolveActiveWorkspace(userId),
        getWorkspaceMemberships(userId),
        getCreatedWorkspaceCount(userId),
      ])
    const activeTier = await subscriptionService.getWorkspaceTier(
      activeMembership.workspace.id
    )
    const createdWorkspaceLimit = isSubscriptionEnforcementEnabled()
      ? getFreeTierCreatedWorkspaceLimit()
      : null

    return {
      hasAdminControls: adminEnabled,
      activeWorkspace: {
        id: activeMembership.workspace.id,
        name: activeMembership.workspace.name,
        slug: activeMembership.workspace.slug,
        role: activeMembership.role,
        tier: activeTier,
      },
      workspaces: memberships.map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
      })),
      createdWorkspaceUsage: {
        current: createdWorkspaceCount,
        limit: createdWorkspaceLimit,
      },
    }
  }),

  switchWorkspace: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

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

      await userActiveWorkspaceCache.set(userId, input.workspaceId)

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
          .max(80, {
            message: "Workspace name must be 80 characters or fewer.",
          }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

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
      const userId = getRequiredUserId(ctx)

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
        hasAdminControls: await hasAdminControlsEnabled(userId),
        isProfilePrivate: input.isProfilePrivate,
      }
    }),
})
