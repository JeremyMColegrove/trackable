import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"

const repoRoot = process.cwd()
const configPath = path.join(repoRoot, "config.json")
const exampleConfigPath = path.join(
  repoRoot,
  "example",
  "trackables.config.example.json"
)

const previousConfig = fs.existsSync(configPath)
  ? fs.readFileSync(configPath, "utf8")
  : null
const forwardedArgs = process.argv.slice(2)

try {
  fs.copyFileSync(exampleConfigPath, configPath)

  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./scripts/register-test-asset-hooks.mjs",
      "--test",
      ...forwardedArgs,
    ],
    {
    cwd: repoRoot,
    stdio: "inherit",
    },
  )

  child.on("exit", (code, signal) => {
    if (previousConfig === null) {
      fs.rmSync(configPath, { force: true })
    } else {
      fs.writeFileSync(configPath, previousConfig, "utf8")
    }

    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 1)
  })
} catch (error) {
  if (previousConfig === null) {
    fs.rmSync(configPath, { force: true })
  } else {
    fs.writeFileSync(configPath, previousConfig, "utf8")
  }

  throw error
}
