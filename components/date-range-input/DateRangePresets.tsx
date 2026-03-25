"use client"

import { useId, useRef } from "react"
import { CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { DateRangePreset } from "./utils/types"

type DateRangePresetsProps = {
  onClose: () => void
  onSelect: (preset: DateRangePreset) => void
  presets: DateRangePreset[]
  selectedPresetKey?: string
  className?: string
}

export function DateRangePresets({
  className,
  onClose,
  onSelect,
  presets,
  selectedPresetKey,
}: DateRangePresetsProps) {
  const labelId = useId()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  function moveFocus(nextIndex: number) {
    const target = buttonRefs.current[nextIndex]
    target?.focus()
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div id={labelId} className="px-1 text-[11px] font-medium text-muted-foreground">
        Presets
      </div>
      <div
        aria-labelledby={labelId}
        role="listbox"
        className="grid gap-1 sm:grid-cols-2"
      >
        {presets.map((preset, index) => {
          const isSelected = preset.key === selectedPresetKey

          return (
            <Button
              key={preset.key}
              ref={(node) => {
                buttonRefs.current[index] = node
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              variant={isSelected ? "secondary" : "ghost"}
              size="sm"
              className="justify-between"
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={() => onSelect(preset)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  moveFocus((index + 1) % presets.length)
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault()
                  moveFocus((index - 1 + presets.length) % presets.length)
                }

                if (event.key === "Home") {
                  event.preventDefault()
                  moveFocus(0)
                }

                if (event.key === "End") {
                  event.preventDefault()
                  moveFocus(presets.length - 1)
                }

                if (event.key === "Escape") {
                  event.preventDefault()
                  onClose()
                }
              }}
            >
              <span className="truncate">{preset.label}</span>
              {isSelected ? <CheckIcon aria-hidden="true" /> : null}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
