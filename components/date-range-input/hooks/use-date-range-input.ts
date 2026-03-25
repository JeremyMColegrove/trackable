"use client"

import { useEffect, useMemo, useState } from "react"

import {
  formatBlurredDateRangeValue,
  formatExpandedDateRange,
} from "../utils/format-date-range"
import { parseDateRange } from "../utils/parse-date-range"
import { defaultDateRangePresets } from "../utils/presets"
import {
  normalizeDateRangeValue,
  type DateRangeChangeMeta,
  type DateRangeCommitReason,
  type DateRangePreset,
  type DateRangeValue,
} from "../utils/types"

type UseDateRangeInputOptions = {
  allowFuture?: boolean
  defaultValue?: DateRangeValue | null
  nowProvider?: () => Date
  onChange?: (value: DateRangeValue | null, meta: DateRangeChangeMeta) => void
  onCommit?: (value: DateRangeValue | null, meta: DateRangeChangeMeta) => void
  presets?: DateRangePreset[]
  value?: DateRangeValue | null
}

function createMeta(
  draft: string,
  previousValue: DateRangeValue | null,
  reason: DateRangeCommitReason
): DateRangeChangeMeta {
  return {
    draft,
    previousValue,
    reason,
  }
}

export function useDateRangeInput({
  allowFuture,
  defaultValue = null,
  nowProvider = () => new Date(),
  onChange,
  onCommit,
  presets = defaultDateRangePresets,
  value,
}: UseDateRangeInputOptions) {
  const isControlled = value !== undefined
  const [uncontrolledValue, setUncontrolledValue] =
    useState<DateRangeValue | null>(
      defaultValue ? normalizeDateRangeValue(defaultValue) : null
    )
  const [draftText, setDraftText] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const committedValue = useMemo(
    () =>
      isControlled
        ? value
          ? normalizeDateRangeValue(value)
          : null
        : uncontrolledValue,
    [isControlled, uncontrolledValue, value]
  )

  const expandedCommittedValue = useMemo(
    () => (committedValue ? formatExpandedDateRange(committedValue) : ""),
    [committedValue]
  )

  useEffect(() => {
    if (!isFocused && !isDirty && !error) {
      setDraftText("")
    }
  }, [error, isDirty, isFocused])

  useEffect(() => {
    if (!isFocused && !isDirty && !error) {
      setDraftText("")
    }
  }, [committedValue, error, isDirty, isFocused])

  function publishValue(
    nextValue: DateRangeValue | null,
    meta: DateRangeChangeMeta
  ) {
    const normalizedValue = nextValue ? normalizeDateRangeValue(nextValue) : null

    if (!isControlled) {
      setUncontrolledValue(normalizedValue)
    }

    onChange?.(normalizedValue, meta)
    onCommit?.(normalizedValue, meta)
  }

  function selectPreset(preset: DateRangePreset) {
    const previousValue = committedValue
    const nextNow = nowProvider()
    const nextValue: DateRangeValue = {
      ...preset.getRange(nextNow),
      source: "preset",
      presetKey: preset.key,
    }

    setError(null)
    setIsDirty(false)
    setDraftText(formatExpandedDateRange(nextValue))
    setIsOpen(true)
    publishValue(nextValue, createMeta(preset.label, previousValue, "preset"))
  }

  function clearValue() {
    const previousValue = committedValue

    setError(null)
    setIsDirty(false)
    setDraftText("")
    publishValue(null, createMeta("", previousValue, "clear"))
  }

  function commitDraft(reason: Exclude<DateRangeCommitReason, "preset">) {
    const nextDraft = draftText.trim()
    const previousValue = committedValue

    if (!nextDraft) {
      if (!committedValue) {
        setError(null)
        setIsDirty(false)
        return true
      }

      clearValue()
      return true
    }

    if (!isDirty && !error && nextDraft === expandedCommittedValue) {
      return true
    }

    const parsedRange = parseDateRange(nextDraft, {
      allowFuture,
      now: nowProvider(),
    })

    if (!parsedRange.ok) {
      setError(parsedRange.error)
      setIsDirty(false)
      return false
    }

    setError(null)
    setIsDirty(false)
    setDraftText(formatExpandedDateRange(parsedRange.value))
    publishValue(parsedRange.value, createMeta(nextDraft, previousValue, reason))
    return true
  }

  function resetDraftToCommitted() {
    setDraftText(expandedCommittedValue)
    setError(null)
    setIsDirty(false)
  }

  const displayValue = useMemo(() => {
    if (isFocused || isOpen) {
      if (error) {
        return ""
      }

      if (isDirty) {
        return draftText
      }

      return expandedCommittedValue
    }

    if (error) {
      return "Invalid Date"
    }

    if (!committedValue) {
      return ""
    }

    return formatBlurredDateRangeValue(committedValue, presets)
  }, [
    committedValue,
    draftText,
    error,
    expandedCommittedValue,
    isFocused,
    isDirty,
    isOpen,
    presets,
  ])

  return {
    committedValue,
    commitDraft,
    displayValue,
    draftText,
    error,
    isDirty,
    isFocused,
    isOpen,
    presets,
    resetDraftToCommitted,
    selectPreset,
    setDraftText(nextValue: string) {
      setDraftText(nextValue)
      setIsDirty(true)
      setError(null)
    },
    setIsFocused,
    setIsOpen,
  }
}
