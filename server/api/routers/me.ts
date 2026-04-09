import { headers } from "next/headers"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { getRuntimeConfig } from "@/lib/runtime-config"
import {
  account as authAccounts,
  session as authSessions,
  user as authUsers,
  users,
} from "@/db/schema"
import { auth } from "@/server/auth"
import {
  createTRPCRouter,
  getRequiredUserId,
  protectedProcedure,
} from "@/server/api/trpc"
import {
  changeEmailInputSchema,
  changePasswordInputSchema,
  revokeSessionInputSchema,
  setPasswordInputSchema,
  updateProfileInputSchema,
} from "@/server/api/routers/me.schemas"

export const meRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = getRequiredUserId(ctx)
    const requestHeaders = new Headers(await headers())

    const appUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        activeWorkspaceId: true,
        displayName: true,
        imageUrl: true,
        isProfilePrivate: true,
        primaryEmail: true,
      },
    })

    const [
      authUserRecord,
      lastLoginSession,
      linkedAccounts,
      credentialAccount,
    ] = await Promise.all([
      db.query.user.findFirst({
        where: eq(authUsers.id, userId),
        columns: {
          lastLoginMethod: true,
        },
      }),
      db.query.session.findFirst({
        where: eq(authSessions.userId, userId),
        columns: {
          createdAt: true,
          ipAddress: true,
        },
        orderBy: (table, operators) => [operators.desc(table.createdAt)],
      }),
      auth.api.listUserAccounts({
        headers: requestHeaders,
      }),
      db.query.account.findFirst({
        where: and(
          eq(authAccounts.userId, userId),
          eq(authAccounts.providerId, "credential")
        ),
        columns: {
          password: true,
        },
      }),
    ])

    return {
      authSession: ctx.auth.session?.session ?? null,
      authUser: ctx.auth.user!,
      appProfile: {
        activeWorkspaceId: appUser?.activeWorkspaceId ?? null,
        displayName: appUser?.displayName ?? null,
        imageUrl: appUser?.imageUrl ?? null,
        isProfilePrivate: appUser?.isProfilePrivate ?? false,
        primaryEmail: appUser?.primaryEmail ?? null,
      },
      capabilities: {
        canManageSessions: true,
        canChangeEmail: getRuntimeConfig().auth.emailServiceEnabled,
        canUpdateProfile: true,
        passwordMode: credentialAccount?.password ? "change" : "set",
      },
      lastLoginAt: lastLoginSession?.createdAt ?? null,
      lastLoginIpAddress: lastLoginSession?.ipAddress ?? null,
      lastLoginMethod: authUserRecord?.lastLoginMethod ?? null,
      linkedAccounts: linkedAccounts ?? [],
    }
  }),

  updateProfile: protectedProcedure
    .input(updateProfileInputSchema)
    .mutation(async ({ input }) => {
      return auth.api.updateUser({
        body: input,
        headers: new Headers(await headers()),
      })
    }),

  changeEmail: protectedProcedure
    .input(changeEmailInputSchema)
    .mutation(async ({ input }) => {
      return auth.api.changeEmail({
        body: input,
        headers: new Headers(await headers()),
      })
    }),

  changePassword: protectedProcedure
    .input(changePasswordInputSchema)
    .mutation(async ({ input }) => {
      const result = await auth.api.changePassword({
        body: input,
        headers: new Headers(await headers()),
      })

      return result
    }),

  setPassword: protectedProcedure
    .input(setPasswordInputSchema)
    .mutation(async ({ input }) => {
      const result = await auth.api.setPassword({
        body: input,
        headers: new Headers(await headers()),
      })

      return result
    }),

  listSessions: protectedProcedure.query(async () => {
    return (
      (await auth.api.listSessions({
        headers: new Headers(await headers()),
      })) ?? []
    )
  }),

  revokeSession: protectedProcedure
    .input(revokeSessionInputSchema)
    .mutation(async ({ input }) => {
      const result = await auth.api.revokeSession({
        body: input,
        headers: new Headers(await headers()),
      })

      return result
    }),

  revokeOtherSessions: protectedProcedure.mutation(async () => {
    return auth.api.revokeOtherSessions({
      headers: new Headers(await headers()),
    })
  }),

  listLinkedAccounts: protectedProcedure.query(async () => {
    return (
      (await auth.api.listUserAccounts({
        headers: new Headers(await headers()),
      })) ?? []
    )
  }),
})
