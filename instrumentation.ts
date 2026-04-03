import {
  getLogger,
  getLoggerConfiguration,
  getSanitizedPostgresTarget,
  getSanitizedRedisTarget,
  summarizeEnvPresence,
} from "@/lib/logger"

declare global {
  var __trackablesInfrastructureStartupLogged: boolean | undefined
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  if (!globalThis.__trackablesInfrastructureStartupLogged) {
    const { getRuntimeConfig, getRuntimeConfigPath } =
      await import("@/lib/runtime-config")
    const runtimeConfig = getRuntimeConfig()

    getLogger("startup").info(
      {
        ...getLoggerConfiguration(),
        runtimeConfigPath: getRuntimeConfigPath(),
        features: {
          batchSchedulerEnabled: runtimeConfig.features.batchSchedulerEnabled,
          subscriptionEnforcementEnabled:
            runtimeConfig.features.subscriptionEnforcementEnabled,
          webhookQueueEnabled: runtimeConfig.webhooks.queue.enabled,
          workspaceBillingEnabled:
            runtimeConfig.features.workspaceBillingEnabled,
        },
        env: summarizeEnvPresence({
          databaseUrl: process.env.DATABASE_URL,
          redisUrl: process.env.REDIS_URL,
          clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
          clerkSecretKey: process.env.CLERK_SECRET_KEY,
          clerkWebhookSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
          lemonSqueezyWebhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
        }),
        targets: {
          postgres: getSanitizedPostgresTarget(),
          redis: getSanitizedRedisTarget(),
        },
      },
      "Infrastructure startup summary."
    )

    globalThis.__trackablesInfrastructureStartupLogged = true
  }

  const { bootstrapBatchScheduler } = await import("@/server/batch/bootstrap")
  const { bootstrapWebhookWorker } =
    await import("@/server/webhooks/webhook-queue.bootstrap")

  await bootstrapBatchScheduler()
  await bootstrapWebhookWorker()
}
