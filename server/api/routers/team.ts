import { TRPCError } from "@trpc/server"
import { and, eq, ilike, isNull, ne, notInArray, or } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { users, workspaceInvitations, workspaceMembers } from "@/db/schema"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { accessControlService } from "@/server/services/access-control.service"
import { workspaceInvitationService } from "@/server/services/workspace-invitation.service"
import { userMembershipsCache } from "@/server/redis/access-control-cache.repository"

const userSearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
})

const inviteMemberSchema = z.object({
  invitedUserId: z.string().min(1),
  role: z.enum(["admin", "member", "viewer"]).default("viewer"),
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
      role: member.role,
      roleLabel:
        member.role === "owner"
          ? "Owner"
          : member.role === "admin"
            ? "Admin"
            : member.role === "viewer"
              ? "Viewer"
              : "Member",
      isOwner: member.role === "owner",
      addedAt: member.createdAt.toISOString(),
    }))
  }),

  listPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    const membership = await accessControlService.resolveActiveWorkspace(userId)

    return workspaceInvitationService.listPendingWorkspaceInvitations(
      userId,
      membership.workspaceId
    )
  }),

  listMyPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    return workspaceInvitationService.listPendingInvitationsForUser(userId)
  }),

  searchUsers: protectedProcedure
    .input(userSearchSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const membership =
        await accessControlService.resolveActiveWorkspace(userId)
      const [existingMembers, pendingInvitations] = await Promise.all([
        db.query.workspaceMembers.findMany({
          where: and(
            eq(workspaceMembers.workspaceId, membership.workspaceId),
            isNull(workspaceMembers.revokedAt)
          ),
          columns: {
            userId: true,
          },
        }),
        db.query.workspaceInvitations.findMany({
          where: and(
            eq(workspaceInvitations.workspaceId, membership.workspaceId),
            eq(workspaceInvitations.status, "pending")
          ),
          columns: {
            invitedUserId: true,
          },
        }),
      ])

      const excludedUserIds = [
        ...new Set(
          [...existingMembers, ...pendingInvitations]
            .map((record) =>
              "userId" in record ? record.userId : record.invitedUserId
            )
            .filter((value): value is string => Boolean(value))
        ),
      ]

      const filters = [
        eq(users.isProfilePrivate, false),
        ne(users.id, userId),
        or(
          ilike(users.displayName, `%${input.query}%`),
          ilike(users.primaryEmail, `%${input.query}%`)
        ),
      ]

      if (excludedUserIds.length > 0) {
        filters.push(notInArray(users.id, excludedUserIds))
      }

      return db.query.users.findMany({
        where: and(...filters),
        limit: 8,
        columns: {
          id: true,
          displayName: true,
          primaryEmail: true,
          imageUrl: true,
        },
      })
    }),

  inviteMember: protectedProcedure
    .input(inviteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const activeMembership =
        await accessControlService.resolveActiveWorkspace(userId)

      const invitation = await workspaceInvitationService.createInvitation({
        inviterUserId: userId,
        workspaceId: activeMembership.workspaceId,
        invitedUserId: input.invitedUserId,
        role: input.role,
      })

      return { ok: true, invitationId: invitation.id }
    }),

  acceptInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return workspaceInvitationService.acceptInvitation({
        invitationId: input.invitationId,
        userId,
      })
    }),

  rejectInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return workspaceInvitationService.rejectInvitation({
        invitationId: input.invitationId,
        userId,
      })
    }),

  revokeInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      return workspaceInvitationService.revokeInvitation({
        invitationId: input.invitationId,
        userId,
      })
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        memberUserId: z.string().min(1),
        role: z.enum(["admin", "member", "viewer"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }

      const activeMembership =
        await accessControlService.resolveActiveWorkspace(userId)
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
          message:
            "The workspace owner cannot have their role changed this way.",
        })
      }

      await db
        .update(workspaceMembers)
        .set({
          role: input.role,
          updatedAt: new Date(),
        })
        .where(eq(workspaceMembers.id, member.id))

      await userMembershipsCache.delete(input.memberUserId)

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

      const activeMembership =
        await accessControlService.resolveActiveWorkspace(userId)
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

      await userMembershipsCache.delete(input.memberUserId)

      return { ok: true }
    }),
})
