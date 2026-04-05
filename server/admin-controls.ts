import "server-only"

import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { getRuntimeConfig } from "@/lib/runtime-config"

export async function hasAdminControlsEnabled(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      primaryEmail: true,
    },
  })

  if (!user) return false

  const configAdmins = getRuntimeConfig().admins
  return !!(user.primaryEmail && configAdmins.includes(user.primaryEmail))
}

export async function assertAdminControlsEnabled(userId: string) {
  const enabled = await hasAdminControlsEnabled(userId)

  if (!enabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin controls are not enabled for this account.",
    })
  }
}
