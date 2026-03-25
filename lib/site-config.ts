const defaultSiteUrl = "https://trackables.org"

function normalizeSiteUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url
  }

  return `https://${url}`
}

export const siteConfig = {
  name: "Trackables",
  title: "Trackables",
  description:
    "Create forms, collect structured responses, and track API usage with share links and API keys.",
  homeTitle: "Trackables: Forms, responses, and API usage tracking",
  homeHeading: "Forms, responses, and API usage in one place.",
  homeSummary:
    "Create shareable forms, collect structured responses, and track usage events with API keys. Review submissions and activity in one dashboard.",
  githubUrl: "https://github.com/JeremyMColegrove/trackable",
  securityContactEmail:
    process.env.SECURITY_CONTACT_EMAIL ??
    process.env.NEXT_PUBLIC_SECURITY_CONTACT_EMAIL ??
    null,
  securityContactUrl:
    process.env.SECURITY_CONTACT_URL ??
    "https://github.com/JeremyMColegrove/trackable/issues",
  securityPolicyUrl: process.env.SECURITY_POLICY_URL ?? null,
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
