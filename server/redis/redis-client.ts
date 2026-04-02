import "server-only"

import Redis, { type RedisOptions } from "ioredis"
import { getLogger, getSanitizedRedisTarget } from "@/lib/logger"

const logger = getLogger("redis")

function getRedisUrl() {
  return process.env.REDIS_URL || "redis://localhost:6379"
}

function createRedisClient(options: RedisOptions = {}) {
  const redisUrl = getRedisUrl()
  const target = getSanitizedRedisTarget(redisUrl)
  const client = new Redis(redisUrl, {
    lazyConnect: true, // Don't crash immediately if Redis is unreachable on start
    maxRetriesPerRequest: 3,
    ...options,
  })

  client.on("connect", () => {
    logger.info(
      {
        target,
        lifecycle: "connect",
      },
      "Redis connection established."
    )
  })

  client.on("ready", () => {
    logger.info(
      {
        target,
        lifecycle: "ready",
      },
      "Redis client is ready."
    )
  })

  client.on("error", (error) => {
    logger.error(
      {
        err: error,
        target,
        lifecycle: "error",
      },
      "Redis connection error."
    )
  })

  client.on("reconnecting", (delay: number) => {
    logger.warn(
      {
        target,
        lifecycle: "reconnecting",
        delayMs: delay,
      },
      "Redis client reconnecting."
    )
  })

  client.on("end", () => {
    logger.warn(
      {
        target,
        lifecycle: "end",
      },
      "Redis connection closed."
    )
  })

  return client
}

export function createBullRedisConnection() {
  return createRedisClient({
    maxRetriesPerRequest: null,
  })
}

// Export a singleton instance
export const redis = createRedisClient()
