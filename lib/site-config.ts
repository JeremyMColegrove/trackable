const defaultSiteUrl = "http://localhost:3000"

function normalizeSiteUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url
  }

  return `https://${url}`
}

export const siteConfig = {
  name: "Trackable",
  title: "Trackable",
  description:
    "Create elegant surveys, collect structured responses, and track usage in one place.",
}

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL

  try {
    return new URL(
      configuredUrl ? normalizeSiteUrl(configuredUrl) : defaultSiteUrl
    )
  } catch {
    return new URL(defaultSiteUrl)
  }
}

export function buildAbsoluteUrl(pathname: string) {
  return new URL(pathname, getSiteUrl())
}
