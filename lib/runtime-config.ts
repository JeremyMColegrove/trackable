import fs from "node:fs"
import path from "node:path"

import { z } from "zod"

const subscriptionTierSchema = z.enum(["free", "plus", "pro"])

const nullablePositiveIntegerSchema = z.number().int().positive().nullable()

const tierLimitsSchema = z.object({
  maxTrackableItems: nullablePositiveIntegerSchema,
  maxResponsesPerSurvey: nullablePositiveIntegerSchema,
  maxWorkspaceMembers: nullablePositiveIntegerSchema,
  maxApiLogsPerMinute: nullablePositiveIntegerSchema,
  maxApiPayloadBytes: nullablePositiveIntegerSchema,
  logRetentionDays: nullablePositiveIntegerSchema,
})

const workspaceTierPlanDisplaySchema = z.object({
  name: z.string().trim().min(1),
  mostPopular: z.boolean(),
  priceLabel: z.string().trim().min(1),
  priceInterval: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tone: z.enum(["neutral", "accent", "strong"]),
})

const subscriptionTierConfigSchema = z.object({
  tier: subscriptionTierSchema,
  rank: z.number().int().min(0),
  lemonSqueezyVariantId: z.string().trim().min(1).nullable(),
  limits: tierLimitsSchema,
  display: workspaceTierPlanDisplaySchema,
})

const runtimeConfigObjectShape = z.object({
  features: z.object({
    subscriptionEnforcementEnabled: z.boolean(),
    workspaceBillingEnabled: z.boolean(),
    batchSchedulerEnabled: z.boolean(),
  }),
  billing: z.object({
    lemonSqueezyStoreId: z.string().trim().min(1).nullable(),
    manageUrl: z.string().trim().url().nullable(),
  }),
  subscriptionTiers: z.object({
    freeTierUserLimits: z.object({
      maxCreatedWorkspaces: nullablePositiveIntegerSchema,
    }),
    plans: z.array(subscriptionTierConfigSchema),
  }),
  usage: z.object({
    invalidApiKeyRateLimitPerMinute: z.number().int().positive(),
    maxBodyBytes: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  }),
  webhooks: z.object({
    queue: z.object({
      enabled: z.boolean(),
      rateLimitMs: z.number().int().positive(),
      rateLimitMax: z.number().int().positive(),
    }),
  }),
  batch: z.object({
    schedulerTimeZone: z.string().trim().min(1),
  }),
})

export const RuntimeConfigShape = runtimeConfigObjectShape.superRefine(
  (value, ctx) => {
    const seenTiers = new Set<string>()
    const seenRanks = new Set<number>()

    for (const [index, plan] of value.subscriptionTiers.plans.entries()) {
      if (seenTiers.has(plan.tier)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate subscription tier "${plan.tier}".`,
          path: ["subscriptionTiers", "plans", index, "tier"],
        })
      }

      if (seenRanks.has(plan.rank)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate subscription plan rank "${plan.rank}".`,
          path: ["subscriptionTiers", "plans", index, "rank"],
        })
      }

      seenTiers.add(plan.tier)
      seenRanks.add(plan.rank)
    }

    for (const tier of subscriptionTierSchema.options) {
      if (!seenTiers.has(tier)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing subscription tier "${tier}".`,
          path: ["subscriptionTiers", "plans"],
        })
      }
    }

    const mostPopularCount = value.subscriptionTiers.plans.filter(
      (plan) => plan.display.mostPopular
    ).length

    if (mostPopularCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one subscription tier can be marked most popular.",
        path: ["subscriptionTiers", "plans"],
      })
    }

    if (value.features.workspaceBillingEnabled) {
      if (!value.billing.lemonSqueezyStoreId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "billing.lemonSqueezyStoreId is required when workspace billing is enabled.",
          path: ["billing", "lemonSqueezyStoreId"],
        })
      }

      for (const [index, plan] of value.subscriptionTiers.plans.entries()) {
        if (plan.tier !== "free" && !plan.lemonSqueezyVariantId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Paid tiers require lemonSqueezyVariantId when workspace billing is enabled.",
            path: [
              "subscriptionTiers",
              "plans",
              index,
              "lemonSqueezyVariantId",
            ],
          })
        }
      }
    }
  }
)

export type RuntimeConfig = z.infer<typeof runtimeConfigObjectShape>
export type SubscriptionTierConfig =
  RuntimeConfig["subscriptionTiers"]["plans"][number]

const subscriptionTierConfigOverrideSchema =
  subscriptionTierConfigSchema.extend({
    rank: subscriptionTierConfigSchema.shape.rank.optional(),
    lemonSqueezyVariantId:
      subscriptionTierConfigSchema.shape.lemonSqueezyVariantId.optional(),
    limits: subscriptionTierConfigSchema.shape.limits.partial().optional(),
    display: subscriptionTierConfigSchema.shape.display.partial().optional(),
  })

const runtimeConfigOverrideSchema = z
  .object({
    features: runtimeConfigObjectShape.shape.features.partial().optional(),
    billing: runtimeConfigObjectShape.shape.billing.partial().optional(),
    subscriptionTiers: runtimeConfigObjectShape.shape.subscriptionTiers
      .extend({
        freeTierUserLimits:
          runtimeConfigObjectShape.shape.subscriptionTiers.shape.freeTierUserLimits
            .partial()
            .optional(),
        plans: z.array(subscriptionTierConfigOverrideSchema).optional(),
      })
      .partial()
      .optional(),
    usage: runtimeConfigObjectShape.shape.usage.partial().optional(),
    webhooks: runtimeConfigObjectShape.shape.webhooks
      .extend({
        queue: runtimeConfigObjectShape.shape.webhooks.shape.queue
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
    batch: runtimeConfigObjectShape.shape.batch.partial().optional(),
  })
  .strict()

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  features: {
    subscriptionEnforcementEnabled: true,
    workspaceBillingEnabled: false,
    batchSchedulerEnabled: true,
  },
  billing: {
    lemonSqueezyStoreId: null,
    manageUrl: null,
  },
  subscriptionTiers: {
    freeTierUserLimits: {
      maxCreatedWorkspaces: 3,
    },
    plans: [
      {
        tier: "free",
        rank: 0,
        lemonSqueezyVariantId: null,
        limits: {
          maxTrackableItems: 10,
          maxResponsesPerSurvey: 100,
          maxWorkspaceMembers: 10,
          maxApiLogsPerMinute: 10,
          maxApiPayloadBytes: 1024,
          logRetentionDays: 3,
        },
        display: {
          name: "Free",
          mostPopular: false,
          priceLabel: "$0",
          priceInterval: "/workspace",
          summary: "A clean starting point for new workspaces.",
          tone: "neutral",
        },
      },
      {
        tier: "plus",
        rank: 1,
        lemonSqueezyVariantId: "1482028",
        limits: {
          maxTrackableItems: 100,
          maxResponsesPerSurvey: null,
          maxWorkspaceMembers: 100,
          maxApiLogsPerMinute: 60,
          maxApiPayloadBytes: 32 * 1024,
          logRetentionDays: 90,
        },
        display: {
          name: "Plus",
          mostPopular: true,
          priceLabel: "$24",
          priceInterval: "/workspace",
          summary: "More room for growing teams and heavier usage.",
          tone: "accent",
        },
      },
      {
        tier: "pro",
        rank: 2,
        lemonSqueezyVariantId: "1482029",
        limits: {
          maxTrackableItems: 1000,
          maxResponsesPerSurvey: null,
          maxWorkspaceMembers: null,
          maxApiLogsPerMinute: 600,
          maxApiPayloadBytes: 32 * 1024 * 10,
          logRetentionDays: 365,
        },
        display: {
          name: "Pro",
          mostPopular: false,
          priceLabel: "$79",
          priceInterval: "/workspace",
          summary: "Expanded limits for high-volume workspaces.",
          tone: "strong",
        },
      },
    ],
  },
  usage: {
    invalidApiKeyRateLimitPerMinute: 30,
    maxBodyBytes: 64 * 1024,
    pageSize: 101,
  },
  webhooks: {
    queue: {
      enabled: true,
      rateLimitMs: 1000,
      rateLimitMax: 1,
    },
  },
  batch: {
    schedulerTimeZone: "UTC",
  },
}

const CONTAINER_RUNTIME_CONFIG_PATH = "/config.json"
const LOCAL_RUNTIME_CONFIG_PATH = path.resolve(process.cwd(), "config.json")
const DEFAULT_RUNTIME_CONFIG_PATH_CANDIDATES = Array.from(
  new Set([CONTAINER_RUNTIME_CONFIG_PATH, LOCAL_RUNTIME_CONFIG_PATH])
)

let cachedRuntimeConfig: RuntimeConfig | null = null
let cachedRuntimeConfigPath: string | null = null

function formatZodError(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const fieldPath = issue.path.length > 0 ? issue.path.join(".") : "config"
      return `${fieldPath}: ${issue.message}`
    })
    .join("\n")
}

export function resolveRuntimeConfigPath(configPath?: string) {
  const normalizedPath = configPath?.trim()

  if (normalizedPath) {
    return path.resolve(normalizedPath)
  }

  for (const candidatePath of DEFAULT_RUNTIME_CONFIG_PATH_CANDIDATES) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath
    }
  }

  return CONTAINER_RUNTIME_CONFIG_PATH
}

export function loadRuntimeConfigFromPath(configPath: string): RuntimeConfig {
  const resolvedPath = resolveRuntimeConfigPath(configPath)
  let rawConfig: string

  try {
    rawConfig = fs.readFileSync(resolvedPath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Runtime config file was not found at "${resolvedPath}".`)
    }

    throw new Error(
      `Failed to read runtime config file at "${resolvedPath}": ${
        error instanceof Error ? error.message : "Unknown error."
      }`
    )
  }

  let parsedConfig: unknown

  try {
    parsedConfig = JSON.parse(rawConfig)
  } catch (error) {
    throw new Error(
      `Runtime config file at "${resolvedPath}" contains invalid JSON: ${
        error instanceof Error ? error.message : "Unknown parse error."
      }`
    )
  }

  const parsedOverrides = runtimeConfigOverrideSchema.safeParse(parsedConfig)

  if (!parsedOverrides.success) {
    throw new Error(
      `Runtime config file at "${resolvedPath}" is invalid:\n${formatZodError(
        parsedOverrides.error
      )}`
    )
  }

  const mergedConfig = mergeRuntimeConfig(parsedOverrides.data)
  const result = RuntimeConfigShape.safeParse(mergedConfig)

  if (!result.success) {
    throw new Error(
      `Runtime config file at "${resolvedPath}" is invalid:\n${formatZodError(
        result.error
      )}`
    )
  }

  return result.data
}

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedRuntimeConfig) {
    return cachedRuntimeConfig
  }

  const resolvedPath = resolveRuntimeConfigPath()
  cachedRuntimeConfig = loadRuntimeConfigFromPath(resolvedPath)
  cachedRuntimeConfigPath = resolvedPath

  return cachedRuntimeConfig
}

export function getRuntimeConfigPath() {
  if (cachedRuntimeConfigPath) {
    return cachedRuntimeConfigPath
  }

  return resolveRuntimeConfigPath()
}

export function resetRuntimeConfigForTests() {
  cachedRuntimeConfig = null
  cachedRuntimeConfigPath = null
}

function mergeRuntimeConfig(
  overrides: z.infer<typeof runtimeConfigOverrideSchema>
): RuntimeConfig {
  const plansByTier = new Map(
    DEFAULT_RUNTIME_CONFIG.subscriptionTiers.plans.map((plan) => [
      plan.tier,
      plan,
    ])
  )

  for (const override of overrides.subscriptionTiers?.plans ?? []) {
    const defaultPlan = plansByTier.get(override.tier)

    if (!defaultPlan) {
      continue
    }

    plansByTier.set(override.tier, {
      ...defaultPlan,
      ...override,
      limits: {
        ...defaultPlan.limits,
        ...override.limits,
      },
      display: {
        ...defaultPlan.display,
        ...override.display,
      },
    })
  }

  return {
    features: {
      ...DEFAULT_RUNTIME_CONFIG.features,
      ...overrides.features,
    },
    billing: {
      ...DEFAULT_RUNTIME_CONFIG.billing,
      ...overrides.billing,
    },
    subscriptionTiers: {
      freeTierUserLimits: {
        ...DEFAULT_RUNTIME_CONFIG.subscriptionTiers.freeTierUserLimits,
        ...overrides.subscriptionTiers?.freeTierUserLimits,
      },
      plans: [...plansByTier.values()].sort(
        (left, right) => left.rank - right.rank
      ),
    },
    usage: {
      ...DEFAULT_RUNTIME_CONFIG.usage,
      ...overrides.usage,
    },
    webhooks: {
      queue: {
        ...DEFAULT_RUNTIME_CONFIG.webhooks.queue,
        ...overrides.webhooks?.queue,
      },
    },
    batch: {
      ...DEFAULT_RUNTIME_CONFIG.batch,
      ...overrides.batch,
    },
  }
}
