import { registerHooks } from "node:module"

const assetExtensionPattern = /\.(avif|gif|jpe?g|png|webp)$/i

registerHooks({
  load(url, context, nextLoad) {
    if (assetExtensionPattern.test(url)) {
      return {
        format: "module",
        shortCircuit: true,
        source: `export default ${JSON.stringify(url)};`,
      }
    }

    return nextLoad(url, context)
  },
})
