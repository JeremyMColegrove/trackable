import "server-only"

import { getLogger } from "@/lib/logger"

const rootBatchLogger = getLogger("batch")

export function getBatchLogger(bindings?: Record<string, string | number>) {
  return bindings ? rootBatchLogger.child(bindings) : rootBatchLogger
}
