import assert from "node:assert/strict"
import test from "node:test"

import {
  getBoundedLogExcerpt,
  getSanitizedPostgresTarget,
  getSanitizedRedisTarget,
  summarizeEnvPresence,
} from "@/lib/logger"

test("getSanitizedPostgresTarget returns a safe host summary", () => {
  assert.deepEqual(
    getSanitizedPostgresTarget("postgresql://trackables:secret@db.internal:5432/app"),
    {
      protocol: "postgresql",
      host: "db.internal",
      port: 5432,
      database: "app",
      hasCredentials: true,
    }
  )
})

test("getSanitizedRedisTarget falls back safely for invalid urls", () => {
  assert.deepEqual(getSanitizedRedisTarget("not a url"), {
    protocol: "unknown",
    host: "unknown",
    port: null,
    database: null,
    hasCredentials: false,
  })
})

test("summarizeEnvPresence returns boolean flags for configured values", () => {
  assert.deepEqual(
    summarizeEnvPresence({
      databaseUrl: "postgresql://db",
      redisUrl: "",
      clerkSecretKey: undefined,
    }),
    {
      databaseUrl: true,
      redisUrl: false,
      clerkSecretKey: false,
    }
  )
})

test("getBoundedLogExcerpt trims and truncates long values", () => {
  assert.equal(getBoundedLogExcerpt("   hello world   "), "hello world")
  assert.equal(getBoundedLogExcerpt("x".repeat(8), 5), "xxxxx...")
  assert.equal(getBoundedLogExcerpt("   "), null)
})
