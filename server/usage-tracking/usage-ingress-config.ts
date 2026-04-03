import { getRuntimeConfig } from "@/lib/runtime-config"

export function getInvalidApiKeyAttemptLimit() {
  return getRuntimeConfig().usage.invalidApiKeyRateLimitPerMinute
}
