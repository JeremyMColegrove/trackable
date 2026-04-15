import { INVALID_API_KEY_RATE_LIMIT_PER_MINUTE } from "@/lib/internal-config"

export function getInvalidApiKeyAttemptLimit() {
  return INVALID_API_KEY_RATE_LIMIT_PER_MINUTE
}
