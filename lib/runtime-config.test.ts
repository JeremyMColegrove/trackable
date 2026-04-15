import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  getRuntimeConfig,
  loadRuntimeConfigFromPath,
  resetRuntimeConfigForTests,
} from "@/lib/runtime-config"

const exampleConfigPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "example",
  "trackables.config.example.json"
)

test("loadRuntimeConfigFromPath parses a valid runtime config file", () => {
  const config = loadRuntimeConfigFromPath(exampleConfigPath)

  assert.equal(config.auth.emailServiceEnabled, false)
  assert.equal(config.features.subscriptionEnforcementEnabled, false)
  assert.equal(config.features.customMCPServerTokens, false)
  assert.equal(config.limits?.length, 1)
  assert.equal(config.billing.tiers.length, 0)
})

test("loadRuntimeConfigFromPath defaults customMCPServerTokens to false when omitted", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trackables-runtime-config-")
  )
  const sparseConfigPath = path.join(tempDirectory, "sparse-config.json")

  fs.writeFileSync(
    sparseConfigPath,
    JSON.stringify({ features: { workspaceBillingEnabled: false } }),
    "utf8"
  )

  try {
    const config = loadRuntimeConfigFromPath(sparseConfigPath)
    assert.equal(config.auth.emailServiceEnabled, false)
    assert.equal(config.features.customMCPServerTokens, false)
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})

test("loadRuntimeConfigFromPath enables customMCPServerTokens when set to true", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trackables-runtime-config-")
  )
  const configPath = path.join(tempDirectory, "config.json")

  fs.writeFileSync(
    configPath,
    JSON.stringify({ features: { customMCPServerTokens: true } }),
    "utf8"
  )

  try {
    const config = loadRuntimeConfigFromPath(configPath)
    assert.equal(config.auth.emailServiceEnabled, false)
    assert.equal(config.features.customMCPServerTokens, true)
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})

test("loadRuntimeConfigFromPath tolerates legacy usage config keys", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trackables-runtime-config-")
  )
  const configPath = path.join(tempDirectory, "config.json")

  fs.writeFileSync(
    configPath,
    JSON.stringify({
      usage: {
        invalidApiKeyRateLimitPerMinute: 10,
        maxBodyBytes: 102400,
        pageSize: 50,
      },
    }),
    "utf8"
  )

  try {
    const config = loadRuntimeConfigFromPath(configPath)
    assert.equal(config.auth.emailServiceEnabled, false)
    assert.equal(config.features.customMCPServerTokens, false)
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})

test("loadRuntimeConfigFromPath merges sparse config files with app defaults", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trackables-runtime-config-")
  )
  const sparseConfigPath = path.join(tempDirectory, "sparse-config.json")

  fs.writeFileSync(
    sparseConfigPath,
    JSON.stringify({
      features: {
        workspaceBillingEnabled: true,
      },
      billing: {
        lemonSqueezyStoreId: "12345",
        tiers: [
          {
            id: "plus",
            name: "Plus",
            priceLabel: "$29",
            priceInterval: "/workspace",
            description: "More room for growing teams.",
            tone: "accent",
            mostPopular: true,
            lemonSqueezyVariantId: "1482028",
            enabled: true,
          },
        ],
      },
    }),
    "utf8"
  )

  try {
    const config = loadRuntimeConfigFromPath(sparseConfigPath)

    assert.equal(config.auth.emailServiceEnabled, false)
    assert.equal(config.features.subscriptionEnforcementEnabled, true)
    assert.equal(config.features.workspaceBillingEnabled, true)
    assert.equal(config.billing.lemonSqueezyStoreId, "12345")
    assert.equal(config.billing.manageUrl, null)
    assert.equal(
      config.billing.tiers.find((t) => t.id === "plus")?.priceLabel,
      "$29"
    )
    // limits not specified — should be undefined (unlimited)
    assert.equal(config.limits, undefined)
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})

test("loadRuntimeConfigFromPath enables auth email delivery when set to true", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trackables-runtime-config-")
  )
  const configPath = path.join(tempDirectory, "config.json")

  fs.writeFileSync(
    configPath,
    JSON.stringify({ auth: { emailServiceEnabled: true } }),
    "utf8"
  )

  try {
    const config = loadRuntimeConfigFromPath(configPath)
    assert.equal(config.auth.emailServiceEnabled, true)
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})

test("getRuntimeConfig loads the fixed config.json file from the project root", () => {
  const rootConfigPath = path.resolve(process.cwd(), "config.json")
  const previousConfig = fs.existsSync(rootConfigPath)
    ? fs.readFileSync(rootConfigPath, "utf8")
    : null
  resetRuntimeConfigForTests()

  try {
    fs.copyFileSync(exampleConfigPath, rootConfigPath)

    const config = getRuntimeConfig()

    assert.equal(config.limits?.length, 1)
  } finally {
    if (previousConfig === null) {
      fs.rmSync(rootConfigPath, { force: true })
    } else {
      fs.writeFileSync(rootConfigPath, previousConfig, "utf8")
    }

    resetRuntimeConfigForTests()
  }
})

test("loadRuntimeConfigFromPath throws when the file does not exist", () => {
  assert.throws(
    () =>
      loadRuntimeConfigFromPath(path.join(os.tmpdir(), "missing-config.json")),
    /Runtime config file was not found/
  )
})

test("loadRuntimeConfigFromPath throws when the path cannot be read as a file", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trackables-runtime-config-")
  )

  try {
    assert.throws(
      () => loadRuntimeConfigFromPath(tempDirectory),
      /Failed to read runtime config file/
    )
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})

test("loadRuntimeConfigFromPath throws when the file contains invalid JSON", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trackables-runtime-config-")
  )
  const invalidJsonPath = path.join(tempDirectory, "invalid.json")
  fs.writeFileSync(invalidJsonPath, "{ invalid", "utf8")

  try {
    assert.throws(
      () => loadRuntimeConfigFromPath(invalidJsonPath),
      /contains invalid JSON/
    )
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})

test("loadRuntimeConfigFromPath throws useful validation errors for explicit invalid overrides", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trackables-runtime-config-")
  )
  const invalidConfigPath = path.join(tempDirectory, "invalid-config.json")

  fs.writeFileSync(
    invalidConfigPath,
    JSON.stringify({
      limits: [
        {
          id: "free",
          maxTrackableItems: 10,
          maxResponsesPerSurvey: 100,
          maxWorkspaceMembers: 10,
          maxApiLogsPerMinute: 10,
          maxApiPayloadBytes: 1024,
          logRetentionDays: 3,
          maxCreatedWorkspaces: 3,
          billingTier: "nonexistent",
        },
      ],
      billing: {
        tiers: [],
      },
    }),
    "utf8"
  )

  try {
    assert.throws(
      () => loadRuntimeConfigFromPath(invalidConfigPath),
      /nonexistent/
    )
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})
