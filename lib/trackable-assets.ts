export function buildTrackableAssetUrl(publicToken: string) {
  return `/api/trackable-assets/${encodeURIComponent(publicToken)}`
}
