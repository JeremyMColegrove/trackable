import pino, { type Bindings, type Logger } from "pino"

export interface SanitizedConnectionTarget {
  protocol: string
  host: string
  port: number | null
  database: string | null
  hasCredentials: boolean
}

const isProduction = process.env.NODE_ENV === "production"
const defaultLogLevel = process.env.LOG_LEVEL ?? "info"

function parseSanitizedConnectionTarget(
  connectionString: string | null | undefined
): SanitizedConnectionTarget {
  if (!connectionString) {
    return {
      protocol: "unknown",
      host: "unknown",
      port: null,
      database: null,
      hasCredentials: false,
    }
  }

  try {
    const parsedUrl = new URL(connectionString)
    const database = parsedUrl.pathname.replace(/^\/+/, "") || null

    return {
      protocol: parsedUrl.protocol.replace(":", "") || "unknown",
      host: parsedUrl.hostname || "unknown",
      port: parsedUrl.port ? Number(parsedUrl.port) : null,
      database,
      hasCredentials: Boolean(parsedUrl.username || parsedUrl.password),
    }
  } catch {
    return {
      protocol: "unknown",
      host: "unknown",
      port: null,
      database: null,
      hasCredentials: false,
    }
  }
}

export function getSanitizedPostgresTarget(
  connectionString: string | null | undefined = process.env.DATABASE_URL
) {
  return parseSanitizedConnectionTarget(connectionString)
}

export function getSanitizedRedisTarget(
  connectionString: string | null | undefined = process.env.REDIS_URL ||
    "redis://localhost:6379"
) {
  return parseSanitizedConnectionTarget(connectionString)
}

export function summarizeEnvPresence(
  entries: Record<string, string | null | undefined>
) {
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, Boolean(value?.trim())])
  )
}

export function getBoundedLogExcerpt(value: unknown, maxLength: number = 300) {
  if (typeof value !== "string") {
    return null
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  return normalizedValue.length > maxLength
    ? `${normalizedValue.slice(0, maxLength)}...`
    : normalizedValue
}

export function getWebhookTargetSummary(targetUrl: string) {
  return parseSanitizedConnectionTarget(targetUrl)
}

export const logger = pino({
  name: "trackables",
  level: defaultLogLevel,
  base: {
    service: "trackables",
    runtime: "nodejs",
  },
  redact: {
    paths: [
      "*.authorization",
      "*.Authorization",
      "*.cookie",
      "*.Cookie",
      "*.set-cookie",
      "*.Set-Cookie",
      "*.x-api-key",
      "*.X-Api-Key",
      "*.apiKey",
      "*.api_key",
      "*.secret",
      "*.secretHash",
      "*.signingSecret",
      "*.webhookSecret",
      "*.connectionString",
      "*.redisUrl",
      "*.databaseUrl",
      "*.signature",
      "*.headers.authorization",
      "*.headers.Authorization",
      "*.headers.cookie",
      "*.headers.Cookie",
      "*.headers.x-trackable-webhook-secret",
      "*.headers.X-Trackable-Webhook-Secret",
      "*.request.headers.authorization",
      "*.request.headers.Authorization",
      "*.request.headers.cookie",
      "*.request.headers.Cookie",
      "*.request.headers.x-trackable-webhook-secret",
      "*.request.headers.X-Trackable-Webhook-Secret",
    ],
    censor: "[Redacted]",
  },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
        },
      },
})

export function getLogger(component: string, bindings?: Bindings): Logger {
  const componentLogger = logger.child({ component })
  return bindings ? componentLogger.child(bindings) : componentLogger
}

export function getLoggerConfiguration() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    logLevel: defaultLogLevel,
  }
}
