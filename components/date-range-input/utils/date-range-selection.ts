type SelectionRange = {
  start: number
  end: number
}

const DATE_TIME_SEPARATOR = " - "
const DATE_TIME_PATTERN =
  /^([A-Za-z]{3,9}) (\d{1,2}), (?:(\d{4}), )?(\d{1,2}):(\d{2}) (am|pm)$/

function getDateTimeSegments(
  value: string,
  offset: number
): SelectionRange[] {
  const match = DATE_TIME_PATTERN.exec(value)
  const month = match?.[1]
  const day = match?.[2]
  const year = match?.[3]
  const hour = match?.[4]
  const minute = match?.[5]
  const meridiem = match?.[6]

  if (!month || !day || !hour || !minute || !meridiem) {
    return []
  }

  const segments: SelectionRange[] = []
  let cursor = offset

  segments.push({
    start: cursor,
    end: cursor + month.length,
  })

  cursor += month.length + 1
  segments.push({
    start: cursor,
    end: cursor + day.length,
  })

  cursor += day.length + 2

  if (year) {
    segments.push({
      start: cursor,
      end: cursor + year.length,
    })
    cursor += year.length + 2
  }

  segments.push({
    start: cursor,
    end: cursor + hour.length,
  })

  cursor += hour.length + 1
  segments.push({
    start: cursor,
    end: cursor + minute.length,
  })

  cursor += minute.length + 1
  segments.push({
    start: cursor,
    end: cursor + meridiem.length,
  })

  return segments
}

function getSelectionSegments(value: string) {
  const parts = value.split(DATE_TIME_SEPARATOR)

  if (parts.length === 1) {
    return getDateTimeSegments(value, 0)
  }

  const left = parts[0] ?? ""
  const right = parts.slice(1).join(DATE_TIME_SEPARATOR)

  return [
    ...getDateTimeSegments(left, 0),
    ...getDateTimeSegments(right, left.length + DATE_TIME_SEPARATOR.length),
  ]
}

export function getNextDateRangeSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: "left" | "right"
): SelectionRange | null {
  const segments = getSelectionSegments(value)

  if (segments.length === 0) {
    return null
  }

  if (direction === "left") {
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index]

      if (!segment) {
        continue
      }

      if (selectionStart !== selectionEnd) {
        if (segment.end <= selectionStart) {
          return segment
        }

        continue
      }

      if (segment.end <= selectionStart) {
        return segment
      }
    }

    if (selectionStart !== selectionEnd) {
      return {
        start: selectionStart,
        end: selectionStart,
      }
    }

    return segments[0] ?? null
  }

  for (const segment of segments) {
    if (selectionStart !== selectionEnd) {
      if (segment.start >= selectionEnd) {
        return segment
      }

      continue
    }

    if (segment.start >= selectionEnd) {
      return segment
    }
  }

  if (selectionStart !== selectionEnd) {
    return {
      start: selectionEnd,
      end: selectionEnd,
    }
  }

  return segments[segments.length - 1] ?? null
}
