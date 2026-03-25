import "server-only"

import type {
  UsageEventSearchInput,
  UsageEventSourceSnapshot,
  UsageEventTableResult,
} from "@/lib/usage-event-search"
import type { UsageEventRecord } from "./event-search-filter"
import { eventSearchFilter } from "./event-search-filter"
import {
  FlatTableStrategy,
  GroupedAggregateStrategy,
  type AggregationStrategy,
} from "./event-aggregation-strategy"

function collectAvailableAggregateFields(events: UsageEventRecord[]) {
  const fields = new Set<string>()

  for (const event of events) {
    for (const key of Object.keys(event.payload)) {
      fields.add(key)
    }
  }

  return Array.from(fields).sort((left, right) => left.localeCompare(right))
}

export class UsageEventTableProcessor {
  private readonly strategy: AggregationStrategy

  constructor(
    private readonly events: UsageEventRecord[],
    private readonly input: UsageEventSearchInput,
    private readonly sourceSnapshot: UsageEventSourceSnapshot,
    private readonly maxLogsFound: boolean,
  ) {
    this.strategy =
      input.aggregation !== "none" && input.aggregateField
        ? new GroupedAggregateStrategy()
        : new FlatTableStrategy()
  }

  process(): UsageEventTableResult {
    const filteredEvents = eventSearchFilter.filter(this.events, this.input)
    const availableAggregateFields = collectAvailableAggregateFields(this.events)

    const result = this.strategy.aggregate(
      filteredEvents,
      this.input,
      this.sourceSnapshot,
    )

    return {
      ...result,
      availableAggregateFields,
      maxLogsFound: this.maxLogsFound,
    }
  }
}
