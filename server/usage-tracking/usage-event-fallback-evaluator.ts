import type {
  ParsedUsageEventSearch,
  UsageEventRecord,
} from "@/server/usage-tracking/usage-event-query.types"

export class UsageEventFallbackEvaluator {
  evaluate(
    rows: UsageEventRecord[],
    parsedSearch: ParsedUsageEventSearch
  ): UsageEventRecord[] {
    if (!parsedSearch.normalizedQuery) {
      return rows
    }

    return rows.filter((row) => parsedSearch.matchesRecord(row))
  }
}
