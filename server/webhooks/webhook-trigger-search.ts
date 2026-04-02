import type {
  LogCountMatchTriggerConfig,
  LogMatchTriggerConfig,
} from "@/db/schema/types"

export class WebhookTriggerSearchBuilder {
  buildLogMatchQuery(input: {
    eventId: string
    liqeQuery: LogMatchTriggerConfig["liqeQuery"]
  }) {
    const baseQuery = this.normalizeQuery(input.liqeQuery)
    const eventQuery = `metadata.logId:=${this.quoteValue(input.eventId)}`

    if (!baseQuery || baseQuery === "*") {
      return eventQuery
    }

    return `(${baseQuery}) AND ${eventQuery}`
  }

  buildLogCountQuery(input: {
    liqeQuery: LogCountMatchTriggerConfig["liqeQuery"]
  }) {
    const normalizedQuery = this.normalizeQuery(input.liqeQuery)
    return normalizedQuery || "*"
  }

  private normalizeQuery(query: string) {
    return query.trim()
  }

  private quoteValue(value: string) {
    return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
  }
}

export const webhookTriggerSearchBuilder = new WebhookTriggerSearchBuilder()
