import { z } from "zod"

import { accountRouter } from "@/server/api/routers/account"
import { batchRouter } from "@/server/api/routers/batch"
import { dashboardRouter } from "@/server/api/routers/dashboard"
import { meRouter } from "@/server/api/routers/me"
import { mcpTokensRouter } from "@/server/api/routers/mcp-tokens"
import { oauthClientsRouter } from "@/server/api/routers/oauth-clients"
import { trackablesRouter } from "@/server/api/routers/project"
import { teamRouter } from "@/server/api/routers/team"
import { workspaceRouter } from "@/server/api/routers/workspace"
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc"

export const appRouter = createTRPCRouter({
  account: accountRouter,
  batch: batchRouter,
  dashboard: dashboardRouter,
  me: meRouter,
  mcpTokens: mcpTokensRouter,
  oauthClients: oauthClientsRouter,
  trackables: trackablesRouter,
  team: teamRouter,
  workspace: workspaceRouter,
  hello: publicProcedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query(({ ctx, input }) => {
      return {
        greeting: `Hello, ${input.text}!`,
        userId: ctx.auth.userId ?? null,
      }
    }),
})

export type AppRouter = typeof appRouter
