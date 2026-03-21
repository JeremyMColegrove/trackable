import { auth } from "@clerk/nextjs/server"
import { TRPCError, initTRPC } from "@trpc/server"

import { ensureUserProvisioned } from "@/server/user-provisioning"
import { logger } from "@/lib/logger"

export async function createTRPCContext() {
  return {
    auth: await auth(),
  }
}

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<TRPCContext>().create()

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const durationMs = Date.now() - start

  if (result.ok) {
    logger.info({ path, type, durationMs }, "tRPC request successful")
  } else {
    logger.error(
      { 
        path, 
        type, 
        durationMs, 
        error: result.error.message, 
        code: result.error.code 
      },
      "tRPC request failed"
    )
  }

  return result
})

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
export const publicProcedure = t.procedure.use(loggerMiddleware)
export const protectedProcedure = t.procedure.use(loggerMiddleware).use(isAuthed)
