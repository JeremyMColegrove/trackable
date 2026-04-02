import type { UsageEventMetadata } from "@/db/schema/types"

export function normalizeUsageEventMetadata(
  metadata: unknown
): UsageEventMetadata | null {
  if (!metadata) {
    return null
  }

  if (isPlainObject(metadata)) {
    return metadata
  }

  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata) as unknown
      return isPlainObject(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  return null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
