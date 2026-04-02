import assert from "node:assert/strict"
import test from "node:test"
import { fireEvent, render } from "@testing-library/react"

import { setupTestDom } from "@/components/date-range-input/__tests__/test-dom"

import { LiqeInput } from "./liqe-input"

test("LiqeInput renders highlighted tokens and submits from the button", () => {
  const teardown = setupTestDom()
  let submitCount = 0

  try {
    const view = render(
      <LiqeInput
        aria-label="Liqe filter"
        defaultValue='level:error AND event:"signup"'
        onSubmit={() => {
          submitCount += 1
        }}
        submit="Apply"
      />
    )

    fireEvent.click(view.getByRole("button", { name: "Apply" }))

    assert.equal(submitCount, 1)
    assert.equal(view.getByText("level:").textContent, "level:")
  } finally {
    teardown()
  }
})
