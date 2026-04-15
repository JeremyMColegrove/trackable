import fs from "node:fs"
import path from "node:path"

import { z } from "zod"

const nullablePositiveIntegerSchema = z.number().int().positive().nullable()

const limitEntrySchema = z.object({
  id: z.string().trim().min(1),
  maxTrackableItems: nullablePositiveIntegerSchema,
  maxResponsesPerSurvey: nullablePositiveIntegerSchema,
  maxWorkspaceMembers: nullablePositiveIntegerSchema,
  maxApiLogsPerMinute: nullablePositiveIntegerSchema,
  maxApiPayloadBytes: nullablePositiveIntegerSchema,
  logRetentionDays: nullablePositiveIntegerSchema,
  maxCreatedWorkspaces: nullablePositiveIntegerSchema,
  billingTier: z.string().trim().min(1).nullable(),
})

const billingTierSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  priceLabel: z.string().trim().min(1),
  priceInterval: z.string().trim().min(1),
  description: z.string().trim().min(1),
  tone: z.enum(["neutral", "accent", "strong"]),
  mostPopular: z.boolean(),
  lemonSqueezyVariantId: z.string().trim().min(1).nullable(),
  enabled: z.boolean(),
})

const runtimeConfigObjectShape = z.object({
  admins: z.array(z.string().email()).optional().default([]),
  auth: z.object({
    emailServiceEnabled: z.boolean(),
  }),
  features: z.object({
    subscriptionEnforcementEnabled: z.boolean(),
    workspaceBillingEnabled: z.boolean(),
    batchSchedulerEnabled: z.boolean(),
    customMCPServerTokens: z.boolean(),
    webhooks: z.union([
      z.boolean(),
      z.array(z.enum(["teams", "general", "discord"])),
    ]),
  }),
  limits: z.array(limitEntrySchema).optional(),
  billing: z.object({
    lemonSqueezyStoreId: z.string().trim().min(1).nullable(),
    manageUrl: z.string().trim().url().nullable(),
    tiers: z.array(billingTierSchema),
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
    if (value.limits) {
      const seenLimitIds = new Set<string>()
      for (const [index, entry] of value.limits.entries()) {
        if (seenLimitIds.has(entry.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate limits entry id "${entry.id}".`,
            path: ["limits", index, "id"],
          })
        }
        seenLimitIds.add(entry.id)
      }

      const billingTierIds = new Set(value.billing.tiers.map((t) => t.id))
      for (const [index, entry] of value.limits.entries()) {
        if (
          entry.billingTier !== null &&
          !billingTierIds.has(entry.billingTier)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Limits entry "${entry.id}" references unknown billing tier "${entry.billingTier}".`,
            path: ["limits", index, "billingTier"],
          })
        }
      }

      let seenNullBillingTier = false
      const seenBillingTierRefs = new Set<string>()
      for (const [index, entry] of value.limits.entries()) {
        if (entry.billingTier === null) {
          if (seenNullBillingTier) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Multiple limits entries have billingTier: null.",
              path: ["limits", index, "billingTier"],
            })
          }
          seenNullBillingTier = true
        } else if (seenBillingTierRefs.has(entry.billingTier)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate billingTier "${entry.billingTier}" in limits.`,
            path: ["limits", index, "billingTier"],
          })
        } else {
          seenBillingTierRefs.add(entry.billingTier)
        }
      }
    }

    const seenBillingIds = new Set<string>()
    for (const [index, tier] of value.billing.tiers.entries()) {
      if (seenBillingIds.has(tier.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate billing tier id "${tier.id}".`,
          path: ["billing", "tiers", index, "id"],
        })
      }
      seenBillingIds.add(tier.id)
    }

    const mostPopularCount = value.billing.tiers.filter(
      (tier) => tier.mostPopular
    ).length
    if (mostPopularCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one billing tier can be marked most popular.",
        path: ["billing", "tiers"],
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

      // lemonSqueezyVariantId: null means an intentionally free (no-payment) tier — skip it.
      for (const [index, tier] of value.billing.tiers.entries()) {
        if (
          tier.enabled &&
          tier.lemonSqueezyVariantId !== null &&
          !tier.lemonSqueezyVariantId
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Enabled paid billing tiers require a non-empty lemonSqueezyVariantId when workspace billing is enabled.",
            path: ["billing", "tiers", index, "lemonSqueezyVariantId"],
          })
        }
      }
    }
  }
)

export type RuntimeConfig = z.infer<typeof runtimeConfigObjectShape>
export type LimitsEntry = NonNullable<RuntimeConfig["limits"]>[number]
export type BillingTierConfig = RuntimeConfig["billing"]["tiers"][number]
export type WebhookFeatureConfig = RuntimeConfig["features"]["webhooks"]
export type WebhookProviderName = "teams" | "general" | "discord"

const configFileSchema = z
  .object({
    admins: z.array(z.string().email()).optional(),
    auth: runtimeConfigObjectShape.shape.auth.partial().optional(),
    features: runtimeConfigObjectShape.shape.features.partial().optional(),
    limits: z.array(limitEntrySchema).optional(),
    billing: z
      .object({
        lemonSqueezyStoreId:
          runtimeConfigObjectShape.shape.billing.shape.lemonSqueezyStoreId.optional(),
        manageUrl:
          runtimeConfigObjectShape.shape.billing.shape.manageUrl.optional(),
        tiers: z.array(billingTierSchema).optional(),
      })
      .optional(),
    webhooks: z
      .object({
        queue: runtimeConfigObjectShape.shape.webhooks.shape.queue
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
    batch: runtimeConfigObjectShape.shape.batch.partial().optional(),
  })
  .strict()

const DEFAULT_RUNTIME_CONFIG: Omit<RuntimeConfig, "admins" | "limits"> & {
  admins: string[]
  limits: undefined
} = {
  admins: [],
  auth: {
    emailServiceEnabled: false,
  },
  features: {
    subscriptionEnforcementEnabled: true,
    workspaceBillingEnabled: false,
    batchSchedulerEnabled: true,
    customMCPServerTokens: false,
    webhooks: true,
  },
  limits: undefined,
  billing: {
    lemonSqueezyStoreId: null,
    manageUrl: null,
    tiers: [],
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

  const parsedFile = configFileSchema.safeParse(parsedConfig)

  if (!parsedFile.success) {
    throw new Error(
      `Runtime config file at "${resolvedPath}" is invalid:\n${formatZodError(
        parsedFile.error
      )}`
    )
  }

  const mergedConfig = mergeRuntimeConfig(parsedFile.data)
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
  overrides: z.infer<typeof configFileSchema>
): RuntimeConfig {
  return {
    admins: overrides.admins ?? DEFAULT_RUNTIME_CONFIG.admins,
    auth: {
      ...DEFAULT_RUNTIME_CONFIG.auth,
      ...overrides.auth,
    },
    features: {
      ...DEFAULT_RUNTIME_CONFIG.features,
      ...overrides.features,
    },
    limits: overrides.limits,
    billing: {
      lemonSqueezyStoreId:
        overrides.billing?.lemonSqueezyStoreId ??
        DEFAULT_RUNTIME_CONFIG.billing.lemonSqueezyStoreId,
      manageUrl:
        overrides.billing?.manageUrl ??
        DEFAULT_RUNTIME_CONFIG.billing.manageUrl,
      tiers: overrides.billing?.tiers ?? DEFAULT_RUNTIME_CONFIG.billing.tiers,
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

const WEBHOOK_PROVIDER_MAP: Record<WebhookProviderName, string> = {
  general: "generic",
  teams: "microsoft_teams",
  discord: "discord",
}

/**
 * Returns the set of enabled DB-level provider types, or `false` if all
 * webhooks are disabled via `features.webhooks: false`.
 */
export function getEnabledWebhookProviders(): Set<string> | false {
  const config = getRuntimeConfig().features.webhooks
  if (config === false) return false
  if (config === true) return new Set(Object.values(WEBHOOK_PROVIDER_MAP))
  return new Set(config.map((name) => WEBHOOK_PROVIDER_MAP[name]))
}
