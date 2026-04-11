import assert from "node:assert/strict"
import test from "node:test"
import { render } from "@testing-library/react"

import { setupTestDom } from "@/components/date-range-input/__tests__/test-dom"
import {
  SignedInDevicesSection,
  type SignedInDevice,
} from "@/components/account-settings/signed-in-devices-section"

const sampleSessions: SignedInDevice[] = [
  {
    browserLabel: "Chrome",
    createdAt: "2026-04-09T15:30:00.000Z",
    deviceLabel: "Mac",
    isCurrent: true,
    location: {
      displayLabel: "Austin, Texas 78701, United States",
    },
    osLabel: "macOS",
    token: "current-session",
  },
  {
    browserLabel: "Safari",
    createdAt: "2026-04-08T12:00:00.000Z",
    deviceLabel: "iPhone",
    isCurrent: false,
    location: {
      displayLabel: "Unavailable",
    },
    osLabel: "iOS",
    token: "other-session",
  },
]

test("SignedInDevicesSection renders signed-in devices and session details", () => {
  const teardown = setupTestDom()

  try {
    const view = render(
      <SignedInDevicesSection sessions={sampleSessions} />
    )

    assert.equal(view.getByText("Mac").textContent, "Mac")
    assert.equal(view.getByText("This device").textContent, "This device")
    assert.equal(
      view.getByText("Chrome / macOS | Austin, Texas 78701, United States")
        .textContent,
      "Chrome / macOS | Austin, Texas 78701, United States"
    )
    assert.equal(view.getAllByText(/Last login/i).length, 2)
    assert.equal(view.container.querySelectorAll("svg").length >= 2, true)
  } finally {
    teardown()
  }
})

test("SignedInDevicesSection shows the empty state", () => {
  const teardown = setupTestDom()

  try {
    const view = render(<SignedInDevicesSection sessions={[]} />)

    assert.equal(
      view.getByText("No active signed-in devices were found.").textContent,
      "No active signed-in devices were found."
    )
  } finally {
    teardown()
  }
})

test("SignedInDevicesSection handles unavailable data cleanly", () => {
  const teardown = setupTestDom()

  try {
    const view = render(
      <SignedInDevicesSection
        sessions={[
          {
            browserLabel: "Unknown browser",
            createdAt: "2026-04-08T12:00:00.000Z",
            deviceLabel: "Unknown device",
            isCurrent: false,
            location: {
              displayLabel: "Unavailable",
            },
            osLabel: "Unknown OS",
            token: "unknown-session",
          },
        ]}
      />
    )

    assert.equal(
      view.getByText("Device details unavailable | Unavailable").textContent,
      "Device details unavailable | Unavailable"
    )
  } finally {
    teardown()
  }
})
