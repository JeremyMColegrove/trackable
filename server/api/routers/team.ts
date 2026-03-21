import { TRPCError } from "@trpc/server"
import { and, eq, ilike, isNull, ne, notInArray, or } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { users, workspaceMembers } from "@/db/schema"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { accessControlService } from "@/server/services/access-control.service"
import { quotaService } from "@/server/subscriptions/quota.service"

const userSearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
})

export const teamRouter = createTRPCRouter({
  getMemberCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    const membership = await accessControlService.resolveActiveWorkspace(userId)

    const members = await db.query.workspaceMembers.findMany({
      where: and(
        eq(workspaceMembers.workspaceId, membership.workspaceId),
        isNull(workspaceMembers.revokedAt)
      ),
      columns: { id: true },
    })

    return { count: members.length }
  }),

  listMembers: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    const membership = await accessControlService.resolveActiveWorkspace(userId)
    const members = await db.query.workspaceMembers.findMany({
      where: and(
        eq(workspaceMembers.workspaceId, membership.workspaceId),
        isNull(workspaceMembers.revokedAt)
      ),
      with: {
        user: {
          columns: {
            id: true,
            displayName: true,
            primaryEmail: true,
            imageUrl: true,
          },
        },
      },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    })

    return members.map((member) => ({
      id: member.user.id,
      displayName: member.user.displayName,
      primaryEmail: member.user.primaryEmail,
      imageUrl: member.user.imageUrl,
      roleLabel:
        member.role === "owner"
          ? "Owner"
          : member.role === "admin"
            ? "Admin"
            : "Member",
      isOwner: member.role === "owner",
      addedAt: member.createdAt.toISOString(),
    }))
  }),

  searchUsers: protectedProcedure
    .input(userSearchSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const membership = await accessControlService.resolveActiveWorkspace(userId)
      const existingMembers = await db.query.workspaceMembers.findMany({
        where: and(
          eq(workspaceMembers.workspaceId, membership.workspaceId),
          isNull(workspaceMembers.revokedAt)
        ),
        columns: {
          userId: true,
        },
      })

      return db.query.users.findMany({
        where: and(
          eq(users.isProfilePrivate, false),
          ne(users.id, userId),
          notInArray(
            users.id,
            existingMembers.map((member) => member.userId)
          ),
          or(
            ilike(users.displayName, `%${input.query}%`),
            ilike(users.primaryEmail, `%${input.query}%`)
          )
        ),
        limit: 8,
        columns: {
          id: true,
          displayName: true,
          primaryEmail: true,
          imageUrl: true,
        },
      })
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        memberUserId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const activeMembership = await accessControlService.resolveActiveWorkspace(userId)
      await accessControlService.assertWorkspaceManagementAccess(
        userId,
        activeMembership.workspaceId
      )

      if (userId === input.memberUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already in this workspace.",
        })
      }

      const member = await db.query.users.findFirst({
        where: eq(users.id, input.memberUserId),
        columns: { id: true, isProfilePrivate: true },
      })

      if (!member || member.isProfilePrivate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        })
      }

      await quotaService.assertCanAddWorkspaceMember(
        activeMembership.workspaceId
      )

      const existingMembership = await db.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, activeMembership.workspaceId),
          eq(workspaceMembers.userId, input.memberUserId)
        ),
        columns: { id: true, revokedAt: true },
      })

      if (existingMembership) {
        await db
          .update(workspaceMembers)
          .set({
            revokedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(workspaceMembers.id, existingMembership.id))
      } else {
        await db.insert(workspaceMembers).values({
          workspaceId: activeMembership.workspaceId,
          userId: input.memberUserId,
          role: "member",
          createdByUserId: userId,
        })
      }

      return { ok: true }
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        memberUserId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const activeMembership = await accessControlService.resolveActiveWorkspace(userId)
      await accessControlService.assertWorkspaceManagementAccess(
        userId,
        activeMembership.workspaceId
      )

      const member = await db.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, activeMembership.workspaceId),
          eq(workspaceMembers.userId, input.memberUserId),
          isNull(workspaceMembers.revokedAt)
        ),
        columns: { id: true, role: true },
      })

      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace member not found.",
        })
      }

      if (member.role === "owner") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The workspace owner cannot be removed yet.",
        })
      }

      await db
        .update(workspaceMembers)
        .set({
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workspaceMembers.id, member.id))

      return { ok: true }
    }),
})
