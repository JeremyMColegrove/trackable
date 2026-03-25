import "server-only"

import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"

export async function hasAdminControlsEnabled(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      hasAdminControls: true,
    },
  })

  return user?.hasAdminControls === true
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
