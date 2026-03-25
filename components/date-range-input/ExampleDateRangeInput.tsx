"use client"

import { useState } from "react"
import { useGT } from "gt-next"

import { DateRangeInput } from "./DateRangeInput"
import type { DateRangeValue } from "./utils/types"

export function ExampleDateRangeInput() {
  const gt = useGT()
  const [value, setValue] = useState<DateRangeValue | null>(null)

  return (
    <div className="w-full max-w-md">
      <DateRangeInput
        aria-label={gt("Log search date range")}
        value={value}
        onChange={(nextValue) => {
          setValue(nextValue)
        }}
      />
    </div>
  )
}
