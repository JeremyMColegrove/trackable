import "server-only"

import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getWorkspaceMemberships } from "@/server/workspaces"
import { BaseCacheRepository } from "./base-cache.repository"

export type CachedWorkspaceMemberships = NonNullable<
  Awaited<ReturnType<typeof getWorkspaceMemberships>>
>

class UserMembershipsCacheRepository extends BaseCacheRepository<CachedWorkspaceMemberships> {
  constructor() {
    super("user-memberships", 3600)
  }

  protected async fetchFallback(
    userId: string
  ): Promise<CachedWorkspaceMemberships | null> {
    return getWorkspaceMemberships(userId)
  }
}

class UserActiveWorkspaceCacheRepository extends BaseCacheRepository<
  string | null
> {
  constructor() {
    super("user-active-workspace", 3600)
  }

  protected async fetchFallback(userId: string): Promise<string | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        activeWorkspaceId: true,
      },
    })
    return user?.activeWorkspaceId ?? null
  }
}

export const userMembershipsCache = new UserMembershipsCacheRepository()
export const userActiveWorkspaceCache = new UserActiveWorkspaceCacheRepository()
