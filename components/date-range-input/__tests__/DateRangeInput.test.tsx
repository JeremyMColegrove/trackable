import assert from "node:assert/strict"
import test from "node:test"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"

import { DateRangeInput } from "../DateRangeInput"
import type { DateRangeValue } from "../utils/types"
import { setupTestDom } from "./test-dom"

const fixedNow = new Date(2026, 2, 24, 9, 0, 0)

function renderInput(props: Partial<ComponentProps<typeof DateRangeInput>> = {}) {
  return render(
    <DateRangeInput
      aria-label="Log range"
      nowProvider={() => new Date(fixedNow)}
      {...props}
    />
  )
}

test("preset selection shows expanded values while active and the preset label when blurred", async () => {
  const teardown = setupTestDom()

  try {
    const user = userEvent.setup({ document: globalThis.document })

    const view = renderInput()

    const input = view.getByRole("textbox", { name: "Log range" })
    await user.click(input)
    await user.click(view.getByRole("option", { name: "Past 4 days" }))

    assert.equal((input as HTMLInputElement).value, "2026-03-20 09:00 -> 2026-03-24 09:00")
    assert.equal(view.getByText("4d").textContent, "4d")

    const outsideButton = document.createElement("button")
    outsideButton.textContent = "Outside"
    document.body.append(outsideButton)
    await user.click(outsideButton)

    assert.equal((input as HTMLInputElement).value, "Past 4 days")
  } finally {
    teardown()
  }
})

test("invalid input keeps the raw draft and leaves the previous committed range intact", async () => {
  const teardown = setupTestDom()

  try {
    const user = userEvent.setup({ document: globalThis.document })
    const defaultValue: DateRangeValue = {
      start: new Date(2026, 2, 24, 8, 0, 0),
      end: new Date(2026, 2, 24, 9, 0, 0),
      source: "preset",
      presetKey: "past_1_hour",
    }

    const view = renderInput({ defaultValue })

    const input = view.getByRole("textbox", { name: "Log range" })
    await user.click(input)
    await user.clear(input)
    await user.type(input, "not a real range")
    await user.keyboard("{Enter}")

    assert.match(view.getByRole("alert").textContent ?? "", /Could not parse/)
    assert.equal((input as HTMLInputElement).value, "not a real range")
    assert.equal(view.getByText("1h").textContent, "1h")
  } finally {
    teardown()
  }
})

test("preset buttons support arrow-key navigation", async () => {
  const teardown = setupTestDom()

  try {
    const user = userEvent.setup({ document: globalThis.document })

    const view = renderInput()

    const input = view.getByRole("textbox", { name: "Log range" })
    await user.click(input)
    await user.tab()

    assert.equal(document.activeElement?.textContent?.includes("Past 15 minutes"), true)

    await user.keyboard("{ArrowDown}")
    assert.equal(document.activeElement?.textContent?.includes("Past 30 minutes"), true)

    await user.keyboard("{Enter}")

    assert.equal((input as HTMLInputElement).value, "2026-03-24 08:30 -> 2026-03-24 09:00")
  } finally {
    teardown()
  }
})

test("custom entry commits on outside blur and collapses to a compact summary", async () => {
  const teardown = setupTestDom()

  try {
    const user = userEvent.setup({ document: globalThis.document })

    const view = renderInput()

    const input = view.getByRole("textbox", { name: "Log range" })
    await user.click(input)
    await user.type(input, "2026-03-20 09:00 -> 2026-03-24 09:00")

    const outsideButton = document.createElement("button")
    outsideButton.textContent = "Outside"
    document.body.append(outsideButton)
    await user.click(outsideButton)

    assert.equal((input as HTMLInputElement).value, "Mar 20 09:00 -> Mar 24 09:00")
    assert.equal(view.getByText("4d").textContent, "4d")
  } finally {
    teardown()
  }
})
