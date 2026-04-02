import type { UsageEventTableData } from "./table-types"

export function mergeUsageEventTablePages(
  pages: UsageEventTableData[] | undefined
): UsageEventTableData | null {
  const firstPage = pages?.[0]

  if (!firstPage) {
    return null
  }

  const lastPage = pages.at(-1) ?? firstPage
  const seenRowIds = new Set<string>()
  const rows = pages.flatMap((page) =>
    page.rows.filter((row) => {
      if (seenRowIds.has(row.id)) {
        return false
      }

      seenRowIds.add(row.id)
      return true
    })
  )
  const totalMatchedEvents = firstPage.totalMatchedEvents

  return {
    ...firstPage,
    hasMore: lastPage.hasMore,
    nextCursor: lastPage.nextCursor,
    rows: rows.map((row) =>
      row.aggregation === "payload_field"
        ? {
            ...row,
            percentage:
              totalMatchedEvents > 0
                ? Number(
                    ((row.totalHits / totalMatchedEvents) * 100).toFixed(1)
                  )
                : 0,
          }
        : row
    ),
  }
}
