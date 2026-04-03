import { readFile } from "node:fs/promises"
import path from "node:path"

const exampleDirectory = path.join(process.cwd(), "example")

async function readExampleFile(fileName: string) {
  try {
    return await readFile(path.join(exampleDirectory, fileName), "utf8")
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`Failed to read example file: ${fileName}`, {
        cause: error,
      })
    }

    return `# Unable to load ${fileName}.\n# Check that the example file exists in the repository.`
  }
}

export async function getSelfHostingExamples() {
  const [envExample, runtimeConfigExample, dockerComposeExample] =
    await Promise.all([
      readExampleFile(".env.example"),
      readExampleFile("trackables.config.example.json"),
      readExampleFile("docker-compose.yml"),
    ])

  return {
    envExample,
    runtimeConfigExample,
    dockerComposeExample,
  }
}
