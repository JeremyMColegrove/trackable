import { eq } from "drizzle-orm"

import { db } from "@/db"
import { workspaceSubscriptions } from "@/db/schema"
import type {
  WorkspaceSubscriptionState,
  WorkspaceSubscriptionUpsertInput,
} from "@/server/subscriptions/types"

export interface WorkspaceSubscriptionRepository {
  findByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscriptionState | null>
  upsert(input: WorkspaceSubscriptionUpsertInput): Promise<void>
}

export class DrizzleWorkspaceSubscriptionRepository
  implements WorkspaceSubscriptionRepository
{
  async findByWorkspaceId(
    workspaceId: string
  ): Promise<WorkspaceSubscriptionState | null> {
    const subscription = await db.query.workspaceSubscriptions.findFirst({
      where: eq(workspaceSubscriptions.workspaceId, workspaceId),
      columns: {
        workspaceId: true,
        lemonSqueezySubscriptionId: true,
        lemonSqueezyCustomerId: true,
        variantId: true,
        tier: true,
        status: true,
        currentPeriodEnd: true,
      },
    })

    return subscription ?? null
  }

  async upsert(input: WorkspaceSubscriptionUpsertInput) {
    await db
      .insert(workspaceSubscriptions)
      .values({
        workspaceId: input.workspaceId,
        lemonSqueezySubscriptionId: input.lemonSqueezySubscriptionId,
        lemonSqueezyCustomerId: input.lemonSqueezyCustomerId,
        variantId: input.variantId,
        tier: input.tier,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd,
      })
      .onConflictDoUpdate({
        target: workspaceSubscriptions.workspaceId,
        set: {
          lemonSqueezySubscriptionId: input.lemonSqueezySubscriptionId,
          lemonSqueezyCustomerId: input.lemonSqueezyCustomerId,
          variantId: input.variantId,
          tier: input.tier,
          status: input.status,
          currentPeriodEnd: input.currentPeriodEnd,
          updatedAt: new Date(),
        },
      })
  }
}

export const workspaceSubscriptionRepository =
  new DrizzleWorkspaceSubscriptionRepository()
