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

  assert.equal(config.features.subscriptionEnforcementEnabled, true)
  assert.equal(config.subscriptionTiers.plans.length, 3)
  assert.equal(config.usage.pageSize, 101)
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
      },
      subscriptionTiers: {
        plans: [
          {
            tier: "plus",
            display: {
              priceLabel: "$29",
            },
          },
        ],
      },
    }),
    "utf8"
  )

  try {
    const config = loadRuntimeConfigFromPath(sparseConfigPath)

    assert.equal(config.features.subscriptionEnforcementEnabled, true)
    assert.equal(config.features.workspaceBillingEnabled, true)
    assert.equal(config.billing.lemonSqueezyStoreId, "12345")
    assert.equal(config.billing.manageUrl, null)
    assert.equal(
      config.subscriptionTiers.plans.find((plan) => plan.tier === "plus")
        ?.display.priceLabel,
      "$29"
    )
    assert.equal(
      config.subscriptionTiers.plans.find((plan) => plan.tier === "plus")
        ?.display.summary,
      "More room for growing teams and heavier usage."
    )
    assert.equal(config.usage.pageSize, 101)
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

    assert.equal(config.subscriptionTiers.plans.length, 3)
    assert.equal(config.usage.pageSize, 101)
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
      subscriptionTiers: {
        plans: [
          {
            tier: "plus",
            display: {
              name: "",
            },
          },
        ],
      },
      usage: {
        pageSize: 0,
      },
    }),
    "utf8"
  )

  try {
    assert.throws(
      () => loadRuntimeConfigFromPath(invalidConfigPath),
      /subscriptionTiers\.plans\.0\.display\.name|usage\.pageSize/
    )
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})
