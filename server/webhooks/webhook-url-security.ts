import { isIP } from "node:net"
import { lookup } from "node:dns/promises"

function normalizeHostname(hostname: string) {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.+$/, "")
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost")
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10))

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false
  }

  const [first, second] = parts

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase()

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe8:") ||
    normalized.startsWith("fe9:") ||
    normalized.startsWith("fea:") ||
    normalized.startsWith("feb:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true
  }

  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length))
  }

  return false
}

function isPrivateOrLocalIp(address: string) {
  const version = isIP(address)

  if (version === 4) {
    return isPrivateIpv4(address)
  }

  if (version === 6) {
    return isPrivateIpv6(address)
  }

  return false
}

function parseWebhookTargetUrl(rawUrl: string) {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error("Webhook target must be a valid absolute URL.")
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Webhook target must use HTTPS.")
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("Webhook target must not include embedded credentials.")
  }

  const hostname = normalizeHostname(parsedUrl.hostname)

  if (!hostname) {
    throw new Error("Webhook target must include a hostname.")
  }

  if (isLocalHostname(hostname)) {
    throw new Error(
      "Webhook target cannot use localhost or other local network addresses."
    )
  }

  if (isPrivateOrLocalIp(hostname)) {
    throw new Error(
      "Webhook target cannot use localhost or other local network addresses."
    )
  }

  return parsedUrl
}

export function validateWebhookTargetUrl(rawUrl: string) {
  parseWebhookTargetUrl(rawUrl)
}

export async function assertSafeWebhookTargetUrl(
  rawUrl: string,
  dnsLookup: typeof lookup = lookup
) {
  const parsedUrl = parseWebhookTargetUrl(rawUrl)
  const hostname = normalizeHostname(parsedUrl.hostname)

  const resolvedAddresses = await dnsLookup(hostname, { all: true })

  for (const resolvedAddress of resolvedAddresses) {
    if (isPrivateOrLocalIp(resolvedAddress.address)) {
      throw new Error(
        "Webhook target cannot resolve to localhost or a private network address."
      )
    }
  }
}
