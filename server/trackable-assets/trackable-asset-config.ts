import path from "node:path"

const defaultMaxUploadBytes = 10 * 1024 * 1024

export function getTrackableAssetStorageRoot() {
  const configuredRoot = process.env.TRACKABLE_ASSET_STORAGE_ROOT?.trim()

  if (configuredRoot) {
    return path.resolve(configuredRoot)
  }

  return path.resolve(process.cwd(), ".data", "trackable-assets")
}

export function getTrackableAssetMaxUploadBytes() {
  const configuredValue = process.env.TRACKABLE_ASSET_MAX_UPLOAD_BYTES?.trim()

  if (!configuredValue) {
    return defaultMaxUploadBytes
  }

  const parsedValue = Number(configuredValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return defaultMaxUploadBytes
  }

  return parsedValue
}

export function getDefaultTrackableAssetMaxUploadBytes() {
  return defaultMaxUploadBytes
}
