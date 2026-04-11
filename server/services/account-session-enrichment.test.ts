import assert from "node:assert/strict"
import test from "node:test"

import {
  buildLocationDisplay,
  enrichAccountSessions,
  getSessionDeviceDetails,
  isPublicIpAddress,
  listEnrichedAccountSessions,
  toSessionLocation,
} from "@/server/services/account-session-enrichment"

test("getSessionDeviceDetails parses a desktop Chrome user agent", () => {
  const details = getSessionDeviceDetails(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
  )

  assert.equal(details.browserLabel, "Chrome")
  assert.equal(details.osLabel, "macOS")
  assert.equal(details.deviceLabel, "Mac")
})

test("getSessionDeviceDetails parses a mobile Safari user agent", () => {
  const details = getSessionDeviceDetails(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1"
  )

  assert.equal(details.browserLabel, "Safari")
  assert.equal(details.osLabel, "iOS")
  assert.equal(details.deviceLabel, "iPhone")
})

test("getSessionDeviceDetails falls back for missing user agent", () => {
  const details = getSessionDeviceDetails(null)

  assert.equal(details.browserLabel, "Unknown browser")
  assert.equal(details.osLabel, "Unknown OS")
  assert.equal(details.deviceLabel, "Unknown device")
  assert.equal(details.userAgent, null)
})

test("isPublicIpAddress rejects private and local addresses", () => {
  assert.equal(isPublicIpAddress("127.0.0.1"), false)
  assert.equal(isPublicIpAddress("10.0.0.5"), false)
  assert.equal(isPublicIpAddress("172.16.1.5"), false)
  assert.equal(isPublicIpAddress("192.168.1.5"), false)
  assert.equal(isPublicIpAddress("::1"), false)
  assert.equal(isPublicIpAddress("fe80::1"), false)
  assert.equal(isPublicIpAddress("8.8.8.8"), true)
})

test("toSessionLocation maps provider fields into the session DTO", () => {
  const location = toSessionLocation({
    city: "Austin",
    country_name: "United States",
    postal: "78701",
    region: "Texas",
    timezone: "America/Chicago",
  })

  assert.deepEqual(location, {
    city: "Austin",
    countryName: "United States",
    displayLabel: "Austin, Texas 78701, United States",
    postalCode: "78701",
    region: "Texas",
    timezone: "America/Chicago",
  })
  assert.equal(
    buildLocationDisplay({
      city: "Austin",
      countryName: "United States",
      postalCode: "78701",
      region: "Texas",
      timezone: "America/Chicago",
    }),
    "Austin, Texas 78701, United States"
  )
})

test("enrichAccountSessions flags the current session and applies location details", () => {
  const sessions = enrichAccountSessions({
    currentSessionToken: "current-token",
    locationByIp: new Map([
      [
        "8.8.8.8",
        {
          city: "Austin",
          countryName: "United States",
          displayLabel: "Austin, Texas 78701, United States",
          postalCode: "78701",
          region: "Texas",
          timezone: "America/Chicago",
        },
      ],
    ]),
    sessions: [
      {
        createdAt: new Date("2026-04-09T00:00:00.000Z"),
        expiresAt: new Date("2026-05-09T00:00:00.000Z"),
        ipAddress: "8.8.8.8",
        token: "current-token",
        updatedAt: new Date("2026-04-09T01:00:00.000Z"),
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
    ],
  })

  assert.equal(sessions.length, 1)
  assert.equal(sessions[0]?.isCurrent, true)
  assert.equal(sessions[0]?.location.displayLabel, "Austin, Texas 78701, United States")
  assert.equal(sessions[0]?.deviceLabel, "Windows PC")
})

test("listEnrichedAccountSessions deduplicates identical public IP lookups", async () => {
  let fetchCallCount = 0

  const sessions = await listEnrichedAccountSessions({
    currentSessionToken: "session-a",
    fetchImpl: async () => {
      fetchCallCount += 1

      return {
        json: async () => ({
          city: "Austin",
          country_name: "United States",
          postal: "78701",
          region: "Texas",
          timezone: "America/Chicago",
        }),
        ok: true,
      } as Response
    },
    listSessions: async () => [
      {
        createdAt: "2026-04-08T00:00:00.000Z",
        expiresAt: "2026-05-08T00:00:00.000Z",
        ipAddress: "8.8.8.8",
        token: "session-a",
        updatedAt: "2026-04-08T00:00:00.000Z",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
      {
        createdAt: "2026-04-07T00:00:00.000Z",
        expiresAt: "2026-05-07T00:00:00.000Z",
        ipAddress: "8.8.8.8",
        token: "session-b",
        updatedAt: "2026-04-07T00:00:00.000Z",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
    ],
  })

  assert.equal(fetchCallCount, 1)
  assert.equal(sessions[0]?.location.displayLabel, "Austin, Texas 78701, United States")
  assert.equal(sessions[1]?.location.displayLabel, "Austin, Texas 78701, United States")
})

test("listEnrichedAccountSessions skips private IPs and survives provider failures", async () => {
  let fetchCallCount = 0

  const sessions = await listEnrichedAccountSessions({
    currentSessionToken: null,
    fetchImpl: async () => {
      fetchCallCount += 1
      throw new Error("lookup failed")
    },
    listSessions: async () => [
      {
        createdAt: "2026-04-08T00:00:00.000Z",
        expiresAt: "2026-05-08T00:00:00.000Z",
        ipAddress: "192.168.1.10",
        token: "private-session",
        updatedAt: "2026-04-08T00:00:00.000Z",
        userAgent: null,
      },
      {
        createdAt: "2026-04-09T00:00:00.000Z",
        expiresAt: "2026-05-09T00:00:00.000Z",
        ipAddress: "8.8.4.4",
        token: "public-session",
        updatedAt: "2026-04-09T00:00:00.000Z",
        userAgent: null,
      },
    ],
  })

  assert.equal(fetchCallCount, 1)
  assert.equal(sessions[0]?.token, "public-session")
  assert.equal(sessions[0]?.location.displayLabel, "Unavailable")
  assert.equal(sessions[1]?.location.displayLabel, "Unavailable")
})
