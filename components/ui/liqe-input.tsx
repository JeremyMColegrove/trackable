"use client"

import * as React from "react"
import highlightWords from "highlight-words"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import { Input } from "./input"

const LIQE_HIGHLIGHT_QUERY =
  '/(\\b(?:AND|OR|NOT)\\b|\\b[a-zA-Z_][\\w.-]*:|"(?:[^"\\\\]|\\\\.)*"|>=|<=|!=|>|<|\\(|\\)|\\*)/gi'

export type LiqeInputProps = React.ComponentProps<typeof Input> & {
  containerClassName?: string
  hint?: React.ReactNode
  onSubmit?: () => void
  submit?: React.ReactNode
  submitDisabled?: boolean
}

export const LiqeInput = React.forwardRef<HTMLInputElement, LiqeInputProps>(
  (
    {
      className,
      containerClassName,
      defaultValue,
      hint,
      onChange,
      onKeyDown,
      onSubmit,
      submit,
      submitDisabled,
      value,
      ...props
    },
    ref
  ) => {
    const isControlled = value !== undefined
    const [uncontrolledValue, setUncontrolledValue] = React.useState(
      typeof defaultValue === "string"
        ? defaultValue
        : String(defaultValue ?? "")
    )
    const currentValue = isControlled
      ? typeof value === "string"
        ? value
        : String(value ?? "")
      : uncontrolledValue
    const chunks = React.useMemo(
      () =>
        highlightWords({
          text: currentValue,
          query: LIQE_HIGHLIGHT_QUERY,
        }),
      [currentValue]
    )

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      if (!isControlled) {
        setUncontrolledValue(event.target.value)
      }

      onChange?.(event)
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Enter" && onSubmit && !submitDisabled) {
        event.preventDefault()
        onSubmit()
      }

      onKeyDown?.(event)
    }

    return (
      <div className={cn("flex flex-col gap-2", containerClassName)}>
        <div className="relative">
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 left-0 flex items-center overflow-hidden rounded-lg px-2.5 py-1 text-base whitespace-pre md:text-sm",
              submit ? "pr-20" : null
            )}
          >
            {chunks.length > 0
              ? chunks.map((chunk) => (
                  <span
                    key={chunk.key}
                    className={
                      chunk.match
                        ? "rounded bg-muted/50 text-muted-foreground"
                        : undefined
                    }
                  >
                    {chunk.text}
                  </span>
                ))
              : null}
          </div>
          <Input
            {...props}
            ref={ref}
            className={cn(
              "bg-transparent text-transparent caret-foreground",
              submit ? "pr-20" : null,
              className
            )}
            defaultValue={undefined}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            value={currentValue}
          />
          {submit ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute top-1/2 right-2 h-7 -translate-y-1/2 rounded-md px-2"
              onClick={onSubmit}
              disabled={submitDisabled}
            >
              {submit}
            </Button>
          ) : null}
        </div>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    )
  }
)

LiqeInput.displayName = "LiqeInput"
