type SessionLocation = {
  city: string | null
  countryName: string | null
  displayLabel: string
  postalCode: string | null
  region: string | null
  timezone: string | null
}

type BaseAuthSession = {
  createdAt: Date | string
  expiresAt: Date | string
  ipAddress?: string | null
  token: string
  updatedAt: Date | string
  userAgent?: string | null
}

export type EnrichedAccountSession = {
  browserLabel: string
  createdAt: Date
  deviceLabel: string
  expiresAt: Date
  ipAddress: string | null
  isCurrent: boolean
  location: SessionLocation
  osLabel: string
  token: string
  updatedAt: Date
  userAgent: string | null
}

type LookupLocationResult = {
  city: string | null
  country_name: string | null
  postal: string | null
  region: string | null
  timezone: string | null
}

type FetchLike = typeof fetch

const UNAVAILABLE_LOCATION: SessionLocation = {
  city: null,
  countryName: null,
  displayLabel: "Unavailable",
  postalCode: null,
  region: null,
  timezone: null,
}

function normalizeDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

function normalizeValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function detectBrowser(userAgent: string) {
  if (/edg\//i.test(userAgent)) {
    return "Edge"
  }

  if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) {
    return "Opera"
  }

  if (/firefox\//i.test(userAgent)) {
    return "Firefox"
  }

  if (/chrome\//i.test(userAgent) || /crios\//i.test(userAgent)) {
    return "Chrome"
  }

  if (/safari\//i.test(userAgent)) {
    return "Safari"
  }

  return "Unknown browser"
}

function detectOperatingSystem(userAgent: string) {
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return "iOS"
  }

  if (/android/i.test(userAgent)) {
    return "Android"
  }

  if (/windows nt/i.test(userAgent)) {
    return "Windows"
  }

  if (/mac os x/i.test(userAgent)) {
    return "macOS"
  }

  if (/cros/i.test(userAgent)) {
    return "Chrome OS"
  }

  if (/linux/i.test(userAgent)) {
    return "Linux"
  }

  return "Unknown OS"
}

function detectDevice(userAgent: string, osLabel: string, browserLabel: string) {
  if (/iphone/i.test(userAgent)) {
    return "iPhone"
  }

  if (/ipad/i.test(userAgent)) {
    return "iPad"
  }

  if (/android/i.test(userAgent) && /mobile/i.test(userAgent)) {
    return "Android phone"
  }

  if (/android/i.test(userAgent)) {
    return "Android tablet"
  }

  if (osLabel === "Windows") {
    return "Windows PC"
  }

  if (osLabel === "macOS") {
    return "Mac"
  }

  if (osLabel === "Linux") {
    return "Linux device"
  }

  if (osLabel === "Chrome OS") {
    return "Chromebook"
  }

  if (browserLabel !== "Unknown browser") {
    return browserLabel
  }

  return "Unknown device"
}

export function getSessionDeviceDetails(userAgent: string | null | undefined) {
  const normalizedUserAgent = normalizeValue(userAgent)

  if (!normalizedUserAgent) {
    return {
      browserLabel: "Unknown browser",
      deviceLabel: "Unknown device",
      osLabel: "Unknown OS",
      userAgent: null,
    }
  }

  const browserLabel = detectBrowser(normalizedUserAgent)
  const osLabel = detectOperatingSystem(normalizedUserAgent)
  const deviceLabel = detectDevice(normalizedUserAgent, osLabel, browserLabel)

  return {
    browserLabel,
    deviceLabel,
    osLabel,
    userAgent: normalizedUserAgent,
  }
}

export function isPublicIpAddress(ipAddress: string | null | undefined) {
  const value = normalizeValue(ipAddress)

  if (!value) {
    return false
  }

  const normalized = value.toLowerCase()

  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return false
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) {
    return false
  }

  return true
}

export function buildLocationDisplay(
  location: Omit<SessionLocation, "displayLabel">
) {
  const cityRegion = [location.city, location.region].filter(Boolean).join(", ")
  const postalCountry = [location.postalCode, location.countryName]
    .filter(Boolean)
    .join(", ")
  const parts = [cityRegion, postalCountry].filter(Boolean)

  return parts.length > 0 ? parts.join(" ") : "Unavailable"
}

export function toSessionLocation(result: LookupLocationResult | null | undefined) {
  const location = {
    city: normalizeValue(result?.city),
    countryName: normalizeValue(result?.country_name),
    postalCode: normalizeValue(result?.postal),
    region: normalizeValue(result?.region),
    timezone: normalizeValue(result?.timezone),
  }

  return {
    ...location,
    displayLabel: buildLocationDisplay(location),
  }
}

export async function lookupSessionLocations(
  sessions: Pick<BaseAuthSession, "ipAddress">[],
  fetchImpl: FetchLike = fetch
) {
  const uniquePublicIps = [...new Set(
    sessions
      .map((session) => normalizeValue(session.ipAddress))
      .filter((ipAddress): ipAddress is string => isPublicIpAddress(ipAddress))
  )]

  if (uniquePublicIps.length === 0) {
    return new Map<string, SessionLocation>()
  }

  const lookups = await Promise.all(
    uniquePublicIps.map(async (ipAddress) => {
      try {
        const response = await fetchImpl(`https://ipapi.co/${ipAddress}/json/`, {
          headers: {
            Accept: "application/json",
          },
        })

        if (!response.ok) {
          return [ipAddress, UNAVAILABLE_LOCATION] as const
        }

        const payload = (await response.json()) as LookupLocationResult & {
          error?: boolean
        }

        if (payload.error) {
          return [ipAddress, UNAVAILABLE_LOCATION] as const
        }

        return [ipAddress, toSessionLocation(payload)] as const
      } catch {
        return [ipAddress, UNAVAILABLE_LOCATION] as const
      }
    })
  )

  return new Map<string, SessionLocation>(lookups)
}

export function enrichAccountSessions(input: {
  currentSessionToken: string | null
  locationByIp: Map<string, SessionLocation>
  sessions: BaseAuthSession[]
}) {
  return input.sessions
    .map<EnrichedAccountSession>((session) => {
      const ipAddress = normalizeValue(session.ipAddress)
      const sessionLocation = ipAddress
        ? input.locationByIp.get(ipAddress) ?? UNAVAILABLE_LOCATION
        : UNAVAILABLE_LOCATION
      const deviceDetails = getSessionDeviceDetails(session.userAgent)

      return {
        browserLabel: deviceDetails.browserLabel,
        createdAt: normalizeDate(session.createdAt),
        deviceLabel: deviceDetails.deviceLabel,
        expiresAt: normalizeDate(session.expiresAt),
        ipAddress,
        isCurrent: input.currentSessionToken === session.token,
        location: sessionLocation,
        osLabel: deviceDetails.osLabel,
        token: session.token,
        updatedAt: normalizeDate(session.updatedAt),
        userAgent: deviceDetails.userAgent,
      }
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export async function listEnrichedAccountSessions(input: {
  currentSessionToken: string | null
  listSessions: () => Promise<BaseAuthSession[] | null | undefined>
  fetchImpl?: FetchLike
}) {
  const sessions = (await input.listSessions()) ?? []
  const locationByIp = await lookupSessionLocations(sessions, input.fetchImpl)

  return enrichAccountSessions({
    currentSessionToken: input.currentSessionToken,
    locationByIp,
    sessions,
  })
}
