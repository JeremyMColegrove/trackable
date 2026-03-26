import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
} from "drizzle-orm"

import { db } from "@/db"
import { apiKeys, trackableApiUsageEvents } from "@/db/schema"
import {
  normalizeDateValue,
  quoteSqlStringLiteral,
} from "@/server/usage-tracking/usage-event-query.shared"
import type {
  UsageEventAvailableFieldsQueryResult,
  UsageEventExecutionPlan,
  UsageEventFlatQueryResult,
  UsageEventGroupedQueryResult,
  UsageEventRecord,
  UsageEventSqlPredicate,
} from "@/server/usage-tracking/usage-event-query.types"

export class UsageEventSqlRepository {
  async countFlatRows(plan: UsageEventExecutionPlan): Promise<number> {
    const filters = this.buildFilters(plan)
    const [result] = await db
      .select({ count: count(trackableApiUsageEvents.id) })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(filters)

    return Number(result?.count ?? 0)
  }

  async fetchFlatRows(
    plan: UsageEventExecutionPlan,
    options?: { limit?: number }
  ): Promise<UsageEventFlatQueryResult> {
    const filters = this.buildFilters(plan)
    const query = db
      .select({
        apiKeyId: apiKeys.id,
        apiKeyLastFour: apiKeys.lastFour,
        apiKeyName: apiKeys.name,
        apiKeyPrefix: apiKeys.keyPrefix,
        id: trackableApiUsageEvents.id,
        metadata: trackableApiUsageEvents.metadata,
        occurredAt: trackableApiUsageEvents.occurredAt,
        payload: trackableApiUsageEvents.payload,
      })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(filters)
      .orderBy(...this.buildFlatOrderBy(plan))

    const rows =
      typeof options?.limit === "number" ? await query.limit(options.limit) : await query

    return {
      rows: rows.map((row) => ({
        apiKey: {
          id: row.apiKeyId,
          maskedKey: `${row.apiKeyPrefix}...${row.apiKeyLastFour}`,
          name: row.apiKeyName,
        },
        id: row.id,
        metadata: row.metadata,
        occurredAt: row.occurredAt,
        payload: row.payload,
      })),
    }
  }

  async fetchGroupedRows(
    plan: UsageEventExecutionPlan,
    options?: { limit?: number }
  ): Promise<UsageEventGroupedQueryResult> {
    const aggregateField = plan.aggregateField

    if (!aggregateField) {
      return {
        rows: [],
        totalGroupedRows: 0,
        totalMatchedEvents: 0,
      }
    }

    const filters = this.buildFilters(plan)
    const groupKeySql = this.buildPayloadTextSql(aggregateField)

    const groupedRowsQuery = db
      .select({
        firstOccurredAt: sql<Date>`min(${trackableApiUsageEvents.occurredAt})`,
        groupValue: groupKeySql,
        lastOccurredAt: sql<Date>`max(${trackableApiUsageEvents.occurredAt})`,
        totalHits: count(trackableApiUsageEvents.id),
      })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(filters)
      .groupBy(groupKeySql)
      .orderBy(...this.buildGroupedOrderBy(plan, groupKeySql))

    const groupedRows =
      typeof options?.limit === "number"
        ? await groupedRowsQuery.limit(options.limit)
        : await groupedRowsQuery

    const totalMatchedEvents = await this.countFlatRows(plan)
    const groupedValues = groupedRows.map((row) => row.groupValue)
    const apiKeysByGroup = await this.fetchApiKeysForGroupValues(
      plan,
      aggregateField,
      groupedValues
    )
    const totalGroupedRows = await this.countGroupedRows(plan, groupKeySql)

    return {
      rows: groupedRows.map((row) => ({
        apiKeys: apiKeysByGroup.get(row.groupValue ?? "__empty__") ?? [],
        firstOccurredAt: normalizeDateValue(row.firstOccurredAt),
        groupValue: row.groupValue,
        id: `${aggregateField}:${row.groupValue ?? "__empty__"}`,
        lastOccurredAt: normalizeDateValue(row.lastOccurredAt),
        totalHits: Number(row.totalHits),
      })),
      totalGroupedRows,
      totalMatchedEvents,
    }
  }

  async fetchAvailableAggregateFields(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventAvailableFieldsQueryResult> {
    const filters = this.buildFilters(plan)
    const rows = await db
      .select({
        payload: trackableApiUsageEvents.payload,
      })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(filters)

    return {
      payloads: rows.map((row) => row.payload),
    }
  }

  private async countGroupedRows(
    plan: UsageEventExecutionPlan,
    groupKeySql: SQL<string | null>
  ) {
    const filters = this.buildFilters(plan)
    const groupedSubquery = db
      .select({
        groupValue: groupKeySql,
      })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(filters)
      .groupBy(groupKeySql)
      .as("usage_event_groups")

    const [result] = await db
      .select({ count: count() })
      .from(groupedSubquery)

    return Number(result?.count ?? 0)
  }

  private async fetchApiKeysForGroupValues(
    plan: UsageEventExecutionPlan,
    aggregateField: string,
    groupedValues: Array<string | null>
  ) {
    if (groupedValues.length === 0) {
      return new Map<string, UsageEventRecord["apiKey"][]>()
    }

    const definedValues = groupedValues.filter(
      (value): value is string => value !== null
    )
    const includeEmptyGroup = groupedValues.includes(null)
    const filters = this.buildFilters(plan)
    const groupKeySql = this.buildPayloadTextSql(aggregateField)
    const valueFilters = []

    if (definedValues.length > 0) {
      valueFilters.push(inArray(groupKeySql, definedValues))
    }

    if (includeEmptyGroup) {
      valueFilters.push(sql`${groupKeySql} is null`)
    }

    const rows = await db
      .select({
        apiKeyId: apiKeys.id,
        apiKeyLastFour: apiKeys.lastFour,
        apiKeyName: apiKeys.name,
        apiKeyPrefix: apiKeys.keyPrefix,
        groupValue: groupKeySql,
      })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(and(filters, orSql(valueFilters)))

    const apiKeysByGroup = new Map<string, Map<string, UsageEventRecord["apiKey"]>>()

    for (const row of rows) {
      const groupKey = row.groupValue ?? "__empty__"
      const existingGroup = apiKeysByGroup.get(groupKey) ?? new Map()
      existingGroup.set(row.apiKeyId, {
        id: row.apiKeyId,
        maskedKey: `${row.apiKeyPrefix}...${row.apiKeyLastFour}`,
        name: row.apiKeyName,
      })
      apiKeysByGroup.set(groupKey, existingGroup)
    }

    return new Map(
      Array.from(apiKeysByGroup.entries()).map(([groupKey, apiKeyMap]) => [
        groupKey,
        Array.from(apiKeyMap.values()),
      ])
    )
  }

  private buildFilters(plan: UsageEventExecutionPlan) {
    const filters = [eq(trackableApiUsageEvents.trackableId, plan.input.trackableId)]

    if (plan.input.from) {
      filters.push(gte(trackableApiUsageEvents.occurredAt, new Date(plan.input.from)))
    }

    if (plan.input.to) {
      filters.push(lte(trackableApiUsageEvents.occurredAt, new Date(plan.input.to)))
    }

    for (const predicate of plan.sqlPredicates) {
      filters.push(this.buildSqlPredicate(predicate))
    }

    return and(...filters)
  }

  private buildSqlPredicate(predicate: UsageEventSqlPredicate) {
    const fieldSql: SQL<string | null> =
      predicate.field.kind === "payload"
        ? this.buildPayloadValueSql(predicate.field.key)
        : predicate.field.key === "id"
          ? sql<string | null>`${apiKeys.id}`
          : sql<string | null>`${apiKeys.name}`

    if (predicate.value === null) {
      return sql`${fieldSql} is null`
    }

    return eq(fieldSql, String(predicate.value))
  }

  private buildFlatOrderBy(plan: UsageEventExecutionPlan) {
    switch (plan.input.sort) {
      case "event": {
        const eventSql = this.buildPayloadTextSql("event")
        return plan.input.dir === "asc"
          ? [asc(eventSql), asc(trackableApiUsageEvents.occurredAt)]
          : [desc(eventSql), desc(trackableApiUsageEvents.occurredAt)]
      }
      case "totalHits": {
        const eventSql = this.buildPayloadTextSql("event")
        return plan.input.dir === "asc"
          ? [asc(eventSql), asc(trackableApiUsageEvents.occurredAt)]
          : [desc(eventSql), desc(trackableApiUsageEvents.occurredAt)]
      }
      case "lastOccurredAt":
      default:
        return plan.input.dir === "asc"
          ? [asc(trackableApiUsageEvents.occurredAt)]
          : [desc(trackableApiUsageEvents.occurredAt)]
    }
  }

  private buildGroupedOrderBy(
    plan: UsageEventExecutionPlan,
    groupKeySql: SQL<string | null>
  ) {
    switch (plan.input.sort) {
      case "event":
        return plan.input.dir === "asc"
          ? [asc(groupKeySql)]
          : [desc(groupKeySql)]
      case "totalHits": {
        const totalHitsSql = sql<number>`count(${trackableApiUsageEvents.id})`
        return plan.input.dir === "asc"
          ? [asc(totalHitsSql), asc(groupKeySql)]
          : [desc(totalHitsSql), desc(groupKeySql)]
      }
      case "lastOccurredAt":
      default: {
        const lastOccurredAtSql = sql<Date>`max(${trackableApiUsageEvents.occurredAt})`
        return plan.input.dir === "asc"
          ? [asc(lastOccurredAtSql), asc(groupKeySql)]
          : [desc(lastOccurredAtSql), desc(groupKeySql)]
      }
    }
  }

  private buildPayloadTextSql(key: string) {
    const quotedKey = sql.raw(quoteSqlStringLiteral(key))

    return sql<string | null>`${trackableApiUsageEvents.payload} ->> ${quotedKey}`
  }

  private buildPayloadValueSql(key: string) {
    return this.buildPayloadTextSql(key)
  }
}

function orSql(conditions: SQL<unknown>[]) {
  if (conditions.length === 0) {
    return sql`false`
  }

  return conditions.reduce((left, right, index) => {
    if (index === 0) {
      return right as ReturnType<typeof sql>
    }

    return sql`${left} or ${right as ReturnType<typeof sql>}`
  }) as ReturnType<typeof sql>
}
