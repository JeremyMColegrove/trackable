const DEFAULT_AUTH_REDIRECT_PATH = "/dashboard"

type ResolveSafeAuthRedirectPathOptions = {
  defaultPath?: string
  origin?: string
}

export function resolveSafeAuthRedirectPath(
  redirectUrl: string | string[] | undefined,
  options: ResolveSafeAuthRedirectPathOptions = {}
) {
  const defaultPath = options.defaultPath ?? DEFAULT_AUTH_REDIRECT_PATH

  if (typeof redirectUrl !== "string") {
    return defaultPath
  }

  const trimmedRedirectUrl = redirectUrl.trim()

  if (!trimmedRedirectUrl) {
    return defaultPath
  }

  if (trimmedRedirectUrl.startsWith("//")) {
    return defaultPath
  }

  if (trimmedRedirectUrl.startsWith("/")) {
    return trimmedRedirectUrl
  }

  if (!options.origin) {
    return defaultPath
  }

  try {
    const redirectTarget = new URL(trimmedRedirectUrl)
    const allowedOrigin = new URL(options.origin)

    if (redirectTarget.origin !== allowedOrigin.origin) {
      return defaultPath
    }

    return `${redirectTarget.pathname}${redirectTarget.search}${redirectTarget.hash}`
  } catch {
    return defaultPath
  }
}

export function getAuthRedirectQuery(redirectPath: string) {
  const safeRedirectPath = resolveSafeAuthRedirectPath(redirectPath)

  return safeRedirectPath === DEFAULT_AUTH_REDIRECT_PATH
    ? ""
    : `?redirect_url=${encodeURIComponent(safeRedirectPath)}`
}
