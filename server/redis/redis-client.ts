import "server-only"

import Redis from "ioredis"

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"

  const client = new Redis(redisUrl, {
    lazyConnect: true, // Don't crash immediately if Redis is unreachable on start
    maxRetriesPerRequest: 3,
  })

  client.on("error", (error) => {
    // Basic error logging, you might want to integrate this with Pino or your preferred logger
    console.error(`[Redis] Error: ${error.message}`)
  })

  return client
}

// Export a singleton instance
export const redis = createRedisClient()
