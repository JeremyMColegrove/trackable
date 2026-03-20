import { auth } from "@clerk/nextjs/server"
import { TRPCError, initTRPC } from "@trpc/server"

import { ensureUserProvisioned } from "@/server/user-provisioning"

export async function createTRPCContext() {
  return {
    auth: await auth(),
  }
}

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<TRPCContext>().create()

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    })
  }

  await ensureUserProvisioned(ctx.auth.userId)

  return next({
    ctx,
  })
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(isAuthed)
