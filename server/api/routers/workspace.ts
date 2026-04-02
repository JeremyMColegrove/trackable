import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { workspaces } from "@/db/schema"
import {
  createTRPCRouter,
  getRequiredUserId,
  protectedProcedure,
} from "@/server/api/trpc"
import { accessControlService } from "@/server/services/access-control.service"
import {
  createWebhookInputSchema,
  testWebhookInputSchema,
  updateWebhookInputSchema,
} from "@/server/webhooks/webhook.schemas"
import { webhookService } from "@/server/webhooks/webhook.service.singleton"

export const workspaceRouter = createTRPCRouter({
  listWebhooks: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      await accessControlService.assertWorkspaceManagementAccess(
        userId,
        input.workspaceId
      )

      const webhooks = await webhookService.listWorkspaceWebhooks(
        input.workspaceId
      )

      return webhooks.map((webhook) => webhook.toRecord())
    }),

  createWebhook: protectedProcedure
    .input(createWebhookInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      await accessControlService.assertWorkspaceManagementAccess(
        userId,
        input.workspaceId
      )

      return (await webhookService.createWebhook(input, userId)).toRecord()
    }),

  updateWebhook: protectedProcedure
    .input(updateWebhookInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      await accessControlService.assertWorkspaceManagementAccess(
        userId,
        input.workspaceId
      )

      return (await webhookService.updateWebhook(input)).toRecord()
    }),

  deleteWebhook: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        webhookId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      await accessControlService.assertWorkspaceManagementAccess(
        userId,
        input.workspaceId
      )

      return webhookService.deleteWebhook(input.webhookId)
    }),

  testWebhook: protectedProcedure
    .input(testWebhookInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      await accessControlService.assertWorkspaceManagementAccess(
        userId,
        input.workspaceId
      )

      return webhookService.testWebhook(input)
    }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const userId = getRequiredUserId(ctx)

    const membership = await accessControlService.resolveActiveWorkspace(userId)

    await accessControlService.assertWorkspaceManagementAccess(
      userId,
      membership.workspaceId
    )

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, membership.workspaceId),
      columns: {
        id: true,
        name: true,
      },
    })

    if (!workspace) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found." })
    }

    return workspace
  }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      const membership = await accessControlService.resolveActiveWorkspace(userId)

      await accessControlService.assertWorkspaceManagementAccess(
        userId,
        membership.workspaceId
      )

      await db
        .update(workspaces)
        .set({
          name: input.name,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, membership.workspaceId))

      return { ok: true }
    }),

  deleteWorkspace: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getRequiredUserId(ctx)

      const membership = await accessControlService.assertWorkspaceAccess(
        userId,
        input.workspaceId
      )

      if (membership.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the workspace owner can delete the workspace.",
        })
      }

      await db
        .delete(workspaces)
        .where(eq(workspaces.id, input.workspaceId))

      return { ok: true }
    }),
})
