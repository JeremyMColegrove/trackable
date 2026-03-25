import "server-only"

import { TRPCError } from "@trpc/server"
import { and, eq, ilike, isNull, or } from "drizzle-orm"

import { db } from "@/db"
import { users, workspaceInvitations, workspaceMembers } from "@/db/schema"
import { userMembershipsCache } from "@/server/redis/access-control-cache.repository"
import {
  accessControlService,
  type WorkspaceRole,
} from "@/server/services/access-control.service"
import {
  getWorkspaceInvitationAcceptanceMembershipAction,
  getWorkspaceInvitationDecisionState,
  getWorkspaceRoleLabel,
  normalizeWorkspaceInvitationEmail,
  type WorkspaceInvitationStatus,
} from "@/server/services/workspace-invitation.helpers"
import { quotaService } from "@/server/subscriptions/quota.service"

function buildInvitationTargetMatch(input: {
  invitedUserId: string | null
  invitedEmail: string | null
}) {
  if (input.invitedUserId && input.invitedEmail) {
    return or(
      eq(workspaceInvitations.invitedUserId, input.invitedUserId),
      eq(workspaceInvitations.invitedEmail, input.invitedEmail)
    )
  }

  if (input.invitedUserId) {
    return eq(workspaceInvitations.invitedUserId, input.invitedUserId)
  }

  if (input.invitedEmail) {
    return eq(workspaceInvitations.invitedEmail, input.invitedEmail)
  }

  throw new Error("Workspace invitation target is required.")
}

function assertWorkspaceInvitationActionable(input: {
  status: WorkspaceInvitationStatus
}) {
  const decisionState = getWorkspaceInvitationDecisionState(input)

  if (decisionState === "actionable") {
    return
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message:
      decisionState === "accepted"
        ? "This invitation has already been accepted."
        : decisionState === "rejected"
          ? "This invitation has already been rejected."
          : "This invitation has already been revoked.",
  })
}

async function findUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: ilike(users.primaryEmail, email),
    columns: {
      id: true,
      displayName: true,
      primaryEmail: true,
      isProfilePrivate: true,
    },
  })
}

async function getInvitationTarget(input: {
  invitedUserId?: string
  invitedEmail?: string
}) {
  const normalizedEmail = input.invitedEmail
    ? normalizeWorkspaceInvitationEmail(input.invitedEmail)
    : null

  if (input.invitedUserId) {
    const invitedUser = await db.query.users.findFirst({
      where: eq(users.id, input.invitedUserId),
      columns: {
        id: true,
        displayName: true,
        primaryEmail: true,
        isProfilePrivate: true,
      },
    })

    if (!invitedUser || invitedUser.isProfilePrivate) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found.",
      })
    }

    return {
      invitedUserId: invitedUser.id,
      invitedEmail:
        normalizedEmail ??
        normalizeWorkspaceInvitationEmail(invitedUser.primaryEmail),
      invitedUser,
    }
  }

  if (!normalizedEmail) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "An invited user or email is required.",
    })
  }

  const invitedUser = await findUserByEmail(normalizedEmail)

  return {
    invitedUserId: invitedUser?.id ?? null,
    invitedEmail: normalizedEmail,
    invitedUser: invitedUser ?? null,
  }
}

export class WorkspaceInvitationService {
  async createInvitation(input: {
    inviterUserId: string
    workspaceId: string
    invitedUserId?: string
    invitedEmail?: string
    role: Exclude<WorkspaceRole, "owner">
  }) {
    await accessControlService.assertWorkspaceManagementAccess(
      input.inviterUserId,
      input.workspaceId
    )

    if (!input.invitedUserId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only existing users can be invited.",
      })
    }

    const inviter = await db.query.users.findFirst({
      where: eq(users.id, input.inviterUserId),
      columns: {
        id: true,
        primaryEmail: true,
      },
    })

    if (!inviter) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found.",
      })
    }

    const target = await getInvitationTarget({
      invitedUserId: input.invitedUserId,
      invitedEmail: input.invitedEmail,
    })

    const inviterEmail = normalizeWorkspaceInvitationEmail(inviter.primaryEmail)

    if (
      target.invitedUserId === input.inviterUserId ||
      target.invitedEmail === inviterEmail
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You are already in this workspace.",
      })
    }

    if (target.invitedUserId) {
      const existingMembership = await db.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.userId, target.invitedUserId),
          isNull(workspaceMembers.revokedAt)
        ),
        columns: { id: true },
      })

      if (existingMembership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That user is already a member of this workspace.",
        })
      }
    }

    const existingPendingInvitation =
      await db.query.workspaceInvitations.findFirst({
        where: and(
          eq(workspaceInvitations.workspaceId, input.workspaceId),
          eq(workspaceInvitations.status, "pending"),
          buildInvitationTargetMatch({
            invitedUserId: target.invitedUserId,
            invitedEmail: target.invitedEmail,
          })
        ),
        columns: { id: true },
      })

    if (existingPendingInvitation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A pending invitation already exists for this person.",
      })
    }

    await quotaService.assertCanAddWorkspaceMember(input.workspaceId)

    const [invitation] = await db
      .insert(workspaceInvitations)
      .values({
        workspaceId: input.workspaceId,
        invitedUserId: target.invitedUserId,
        invitedEmail: target.invitedEmail,
        invitedByUserId: input.inviterUserId,
        role: input.role,
        status: "pending",
      })
      .returning({
        id: workspaceInvitations.id,
      })

    return invitation
  }

  async listPendingWorkspaceInvitations(userId: string, workspaceId: string) {
    await accessControlService.assertWorkspaceManagementAccess(
      userId,
      workspaceId
    )

    const invitations = await db.query.workspaceInvitations.findMany({
      where: and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        eq(workspaceInvitations.status, "pending")
      ),
      with: {
        invitedUser: {
          columns: {
            id: true,
            displayName: true,
            primaryEmail: true,
            imageUrl: true,
          },
        },
        invitedByUser: {
          columns: {
            id: true,
            displayName: true,
            primaryEmail: true,
          },
        },
      },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    })

    return invitations.map((invitation) => ({
      id: invitation.id,
      role: invitation.role,
      roleLabel: getWorkspaceRoleLabel(invitation.role),
      status: invitation.status,
      invitedEmail:
        invitation.invitedUser?.primaryEmail ?? invitation.invitedEmail ?? null,
      invitedDisplayName:
        invitation.invitedUser?.displayName ??
        invitation.invitedEmail ??
        "Pending invite",
      imageUrl: invitation.invitedUser?.imageUrl ?? null,
      invitedByDisplayName:
        invitation.invitedByUser.displayName ??
        invitation.invitedByUser.primaryEmail,
      invitedByEmail: invitation.invitedByUser.primaryEmail,
      createdAt: invitation.createdAt.toISOString(),
    }))
  }

  async listPendingInvitationsForUser(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        primaryEmail: true,
      },
    })

    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found.",
      })
    }

    const normalizedEmail = normalizeWorkspaceInvitationEmail(user.primaryEmail)
    const invitations = await db.query.workspaceInvitations.findMany({
      where: and(
        eq(workspaceInvitations.status, "pending"),
        or(
          eq(workspaceInvitations.invitedUserId, userId),
          eq(workspaceInvitations.invitedEmail, normalizedEmail)
        )
      ),
      with: {
        workspace: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
        invitedByUser: {
          columns: {
            id: true,
            displayName: true,
            primaryEmail: true,
          },
        },
      },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    })

    return invitations.map((invitation) => ({
      id: invitation.id,
      workspaceId: invitation.workspace.id,
      workspaceName: invitation.workspace.name,
      workspaceSlug: invitation.workspace.slug,
      role: invitation.role,
      roleLabel: getWorkspaceRoleLabel(invitation.role),
      invitedByDisplayName:
        invitation.invitedByUser.displayName ??
        invitation.invitedByUser.primaryEmail,
      invitedByEmail: invitation.invitedByUser.primaryEmail,
      createdAt: invitation.createdAt.toISOString(),
    }))
  }

  async acceptInvitation(input: { invitationId: string; userId: string }) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
      columns: {
        id: true,
        primaryEmail: true,
      },
    })

    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found.",
      })
    }

    const normalizedEmail = normalizeWorkspaceInvitationEmail(user.primaryEmail)
    const invitation = await db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.id, input.invitationId),
      columns: {
        id: true,
        workspaceId: true,
        invitedUserId: true,
        invitedEmail: true,
        invitedByUserId: true,
        role: true,
        status: true,
      },
    })

    if (!invitation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace invitation not found.",
      })
    }

    const isInvitedUser =
      invitation.invitedUserId === input.userId ||
      invitation.invitedEmail === normalizedEmail

    if (!isInvitedUser) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only respond to your own invitations.",
      })
    }

    assertWorkspaceInvitationActionable({ status: invitation.status })

    await db.transaction(async (tx) => {
      const now = new Date()
      const existingMembership = await tx.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, invitation.workspaceId),
          eq(workspaceMembers.userId, input.userId)
        ),
        columns: {
          id: true,
          revokedAt: true,
        },
      })

      const membershipAction = getWorkspaceInvitationAcceptanceMembershipAction(
        {
          hasActiveMembership: existingMembership?.revokedAt === null,
          hasRevokedMembership: Boolean(existingMembership?.revokedAt),
        }
      )

      if (membershipAction !== "none") {
        await quotaService.assertCanAddWorkspaceMember(invitation.workspaceId)
      }

      if (membershipAction === "restore") {
        await tx
          .update(workspaceMembers)
          .set({
            role: invitation.role,
            revokedAt: null,
            updatedAt: now,
          })
          .where(eq(workspaceMembers.id, existingMembership!.id))
      }

      if (membershipAction === "create") {
        await tx.insert(workspaceMembers).values({
          workspaceId: invitation.workspaceId,
          userId: input.userId,
          role: invitation.role,
          createdByUserId: invitation.invitedByUserId,
        })
      }

      const [updatedInvitation] = await tx
        .update(workspaceInvitations)
        .set({
          invitedUserId: input.userId,
          status: "accepted",
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceInvitations.id, invitation.id),
            eq(workspaceInvitations.status, "pending"),
            or(
              eq(workspaceInvitations.invitedUserId, input.userId),
              eq(workspaceInvitations.invitedEmail, normalizedEmail)
            )
          )
        )
        .returning({
          id: workspaceInvitations.id,
        })

      if (!updatedInvitation) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation can no longer be accepted.",
        })
      }
    })

    await userMembershipsCache.delete(input.userId)

    return { ok: true }
  }

  async rejectInvitation(input: { invitationId: string; userId: string }) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
      columns: {
        id: true,
        primaryEmail: true,
      },
    })

    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found.",
      })
    }

    const normalizedEmail = normalizeWorkspaceInvitationEmail(user.primaryEmail)
    const invitation = await db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.id, input.invitationId),
      columns: {
        id: true,
        invitedUserId: true,
        invitedEmail: true,
        status: true,
      },
    })

    if (!invitation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace invitation not found.",
      })
    }

    const isInvitedUser =
      invitation.invitedUserId === input.userId ||
      invitation.invitedEmail === normalizedEmail

    if (!isInvitedUser) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only respond to your own invitations.",
      })
    }

    assertWorkspaceInvitationActionable({ status: invitation.status })

    const [updatedInvitation] = await db
      .update(workspaceInvitations)
      .set({
        invitedUserId: input.userId,
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceInvitations.id, invitation.id),
          eq(workspaceInvitations.status, "pending"),
          or(
            eq(workspaceInvitations.invitedUserId, input.userId),
            eq(workspaceInvitations.invitedEmail, normalizedEmail)
          )
        )
      )
      .returning({
        id: workspaceInvitations.id,
      })

    if (!updatedInvitation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This invitation can no longer be rejected.",
      })
    }

    return { ok: true }
  }

  async revokeInvitation(input: { invitationId: string; userId: string }) {
    const invitation = await db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.id, input.invitationId),
      columns: {
        id: true,
        workspaceId: true,
        status: true,
      },
    })

    if (!invitation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace invitation not found.",
      })
    }

    await accessControlService.assertWorkspaceManagementAccess(
      input.userId,
      invitation.workspaceId
    )

    assertWorkspaceInvitationActionable({ status: invitation.status })

    const [updatedInvitation] = await db
      .update(workspaceInvitations)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceInvitations.id, invitation.id),
          eq(workspaceInvitations.status, "pending")
        )
      )
      .returning({
        id: workspaceInvitations.id,
      })

    if (!updatedInvitation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This invitation can no longer be revoked.",
      })
    }

    return { ok: true }
  }
}

export const workspaceInvitationService = new WorkspaceInvitationService()
