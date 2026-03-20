import "server-only"

import { hostname } from "node:os"

import pino from "pino"

const rootBatchLogger = pino({
  name: "batch",
  base: {
    hostname: hostname(),
    pid: process.pid,
  },
})

export function getBatchLogger(bindings?: Record<string, string | number>) {
  return bindings ? rootBatchLogger.child(bindings) : rootBatchLogger
}
