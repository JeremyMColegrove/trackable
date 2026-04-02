import { Buffer } from "node:buffer"

import {
  type SQL,
  type SQLWrapper,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { QueryBuilder } from "drizzle-orm/pg-core/query-builders/query-builder"
import { TRPCError } from "@trpc/server"

import { apiKeys, trackableApiUsageEvents } from "@/db/schema"
import { normalizeUsageEventMetadata } from "@/server/usage-tracking/usage-event-metadata"
import { normalizeDateValue } from "@/server/usage-tracking/usage-event-query.shared"
import type {
  UsageEventAvailableFieldsQueryResult,
  UsageEventCompiledExpression,
  UsageEventExecutionPlan,
  UsageEventFlatQueryResult,
  UsageEventGroupedRowsPage,
  UsageEventGroupedTotals,
  UsageEventRecord,
  UsageEventSqlField,
} from "@/server/usage-tracking/usage-event-query.types"

const EMPTY_JSON_ARRAY_SQL = sql.raw("'[]'::jsonb")
const EMPTY_JSON_OBJECT_SQL = sql.raw("'{}'::jsonb")
const JSON_ROOT_PATH_SQL = sql.raw("ARRAY[]::text[]")
const MISSING_GROUP_IDENTITY = "__missing__"

type FlatCursor = {
  id: string
  occurredAt: string
  sortValue?: string
}

type GroupedCursor = {
  groupIdentity: string
  sortValue: number | string
}

type SqlValue = SQLWrapper

type UsageEventSqlDatabase = {
  execute(query: SQLWrapper): Promise<{ rows: Record<string, unknown>[] }>
}

type SurroundingUsageEventsInput = {
  afterCount: number
  beforeCount: number
  eventId: string
  trackableId: string
}

export class UsageEventSqlRepository {
  constructor(
    private readonly database?: UsageEventSqlDatabase,
    private readonly queryBuilder = new QueryBuilder({ casing: "snake_case" }),
    readonly dialect = new PgDialect({ casing: "snake_case" })
  ) {}

  async countFlatRows(plan: UsageEventExecutionPlan): Promise<number> {
    const result = await this.requireDatabase().execute(
      this.buildCountFlatRowsQuery(plan)
    )
    const rows = result.rows as Array<{ count: string | number }>

    return Number(rows[0]?.count ?? 0)
  }

  buildCountFlatRowsQuery(plan: UsageEventExecutionPlan) {
    const filters = this.buildFilters(plan)

    return this.queryBuilder
      .select({ count: count(trackableApiUsageEvents.id) })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(filters)
  }

  async fetchFlatRows(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventFlatQueryResult> {
    const pageSize = this.requirePageSize(plan)
    const result = await this.requireDatabase().execute(
      this.buildFetchFlatRowsQuery(plan)
    )
    const rows = result.rows.map((row) => this.normalizeFlatQueryRow(row))
    const hasMore = rows.length > pageSize
    const visibleRows = hasMore ? rows.slice(0, pageSize) : rows
    const lastVisibleRow = visibleRows.at(-1)

    return {
      hasMore,
      nextCursor:
        hasMore && lastVisibleRow
          ? this.encodeCursor<FlatCursor>({
              id: lastVisibleRow.id,
              occurredAt: lastVisibleRow.occurredAt.toISOString(),
              ...(plan.input.sort === "event"
                ? { sortValue: lastVisibleRow.sortValue ?? "" }
                : {}),
            })
          : null,
      rows: visibleRows.map((row) => this.mapFlatRow(row)),
    }
  }

  async fetchSurroundingFlatRows(
    input: SurroundingUsageEventsInput
  ): Promise<UsageEventRecord[]> {
    const result = await this.requireDatabase().execute(
      this.buildFetchSurroundingFlatRowsQuery(input)
    )

    return result.rows.map((row) =>
      this.mapFlatRow(this.normalizeFlatQueryRow(row))
    )
  }

  buildFetchFlatRowsQuery(plan: UsageEventExecutionPlan) {
    const filters = this.buildFilters(plan)
    const pageLimit = this.requirePageSize(plan) + 1
    const eventSortValueSql = this.buildDisplayTextSql(
      this.buildJsonValueSql(trackableApiUsageEvents.payload, ["event"])
    )
    const cursor = this.decodeCursor<FlatCursor>(plan.input.cursor)

    return this.queryBuilder
      .select(this.buildFlatRowSelection(eventSortValueSql))
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(
        and(
          filters,
          this.buildFlatCursorFilter(plan, cursor, eventSortValueSql)
        )
      )
      .orderBy(...this.buildFlatOrderBy(plan, eventSortValueSql))
      .limit(pageLimit)
  }

  buildFetchSurroundingFlatRowsQuery(input: SurroundingUsageEventsInput) {
    return sql`
      with ranked_events as (
        select
          ${apiKeys.id} as api_key_id,
          ${apiKeys.lastFour} as api_key_last_four,
          ${apiKeys.name} as api_key_name,
          ${apiKeys.keyPrefix} as api_key_prefix,
          ${trackableApiUsageEvents.id} as id,
          ${trackableApiUsageEvents.metadata} as metadata,
          ${trackableApiUsageEvents.occurredAt} as occurred_at,
          ${trackableApiUsageEvents.payload} as payload,
          row_number() over (
            order by ${trackableApiUsageEvents.occurredAt} desc, ${trackableApiUsageEvents.id} desc
          ) as row_index
        from ${trackableApiUsageEvents}
        inner join ${apiKeys} on ${trackableApiUsageEvents.apiKeyId} = ${apiKeys.id}
        where ${trackableApiUsageEvents.trackableId} = ${input.trackableId}
      ),
      anchor_event as (
        select row_index
        from ranked_events
        where id = ${input.eventId}
      )
      select
        ranked_events.api_key_id,
        ranked_events.api_key_last_four,
        ranked_events.api_key_name,
        ranked_events.api_key_prefix,
        ranked_events.id,
        ranked_events.metadata,
        ranked_events.occurred_at,
        ranked_events.payload
      from ranked_events
      inner join anchor_event on true
      where ranked_events.row_index between greatest(anchor_event.row_index - ${input.beforeCount}, 1)
        and anchor_event.row_index + ${input.afterCount}
      order by ranked_events.row_index asc
    `
  }

  async fetchGroupedRowsPage(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventGroupedRowsPage> {
    const aggregateField = plan.aggregateField

    if (!aggregateField) {
      return {
        hasMore: false,
        nextCursor: null,
        rows: [],
      }
    }

    const pageRows = await this.requireDatabase().execute(
      this.buildFetchGroupedRowsQuery(plan)
    )

    const pageRowsData = pageRows.rows.map((row) =>
      this.normalizeGroupedQueryRow(row)
    )
    const pageSize = this.requirePageSize(plan)
    const hasMore = pageRowsData.length > pageSize
    const visibleRows = hasMore ? pageRowsData.slice(0, pageSize) : pageRowsData
    const lastVisibleRow = visibleRows.at(-1)

    return {
      hasMore,
      nextCursor:
        hasMore && lastVisibleRow
          ? this.encodeCursor<GroupedCursor>({
              groupIdentity: lastVisibleRow.groupIdentity,
              sortValue:
                plan.input.sort === "totalHits"
                  ? lastVisibleRow.totalHits
                  : plan.input.sort === "event"
                    ? (lastVisibleRow.sortValue ?? "")
                    : lastVisibleRow.lastOccurredAt.toISOString(),
            })
          : null,
      rows: visibleRows.map((row) => ({
        apiKeys: [...(row.apiKeys ?? [])].sort((left, right) =>
          left.name.localeCompare(right.name)
        ),
        firstOccurredAt: normalizeDateValue(row.firstOccurredAt),
        groupValue: row.groupValue,
        id: `${aggregateField}:${row.groupIdentity}`,
        lastOccurredAt: normalizeDateValue(row.lastOccurredAt),
        totalHits: Number(row.totalHits),
      })),
    }
  }

  async fetchGroupedTotals(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventGroupedTotals> {
    const [totalMatchedEvents, totalGroupedRows] = await Promise.all([
      this.countFlatRows(plan),
      this.countGroupedRows(plan),
    ])

    return {
      totalGroupedRows,
      totalMatchedEvents,
    }
  }

  buildFetchGroupedRowsQuery(plan: UsageEventExecutionPlan) {
    const aggregateField = plan.aggregateField

    if (!aggregateField) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Grouped usage event queries require an aggregate field.",
      })
    }

    const groupedSubquery = this.buildGroupedSubquery(plan, aggregateField)
    const cursor = this.decodeCursor<GroupedCursor>(plan.input.cursor)
    const pageLimit = this.requirePageSize(plan) + 1

    return this.queryBuilder
      .select({
        apiKeys: groupedSubquery.apiKeys,
        firstOccurredAt: groupedSubquery.firstOccurredAt,
        groupIdentity: groupedSubquery.groupIdentity,
        groupValue: groupedSubquery.groupValue,
        lastOccurredAt: groupedSubquery.lastOccurredAt,
        sortValue: groupedSubquery.sortValue,
        totalHits: groupedSubquery.totalHits,
      })
      .from(groupedSubquery)
      .where(this.buildGroupedCursorFilter(plan, cursor, groupedSubquery))
      .orderBy(...this.buildGroupedOrderBy(plan, groupedSubquery))
      .limit(pageLimit)
  }

  async fetchAvailableAggregateFields(
    plan: UsageEventExecutionPlan
  ): Promise<UsageEventAvailableFieldsQueryResult> {
    const result = await this.requireDatabase().execute(
      this.buildAvailableAggregateFieldsSql(plan)
    )
    const rows = result.rows as Array<{ field: string }>

    return {
      fields: rows.map((row) => row.field),
    }
  }

  buildAvailableAggregateFieldsSql(plan: UsageEventExecutionPlan) {
    const filters = this.buildFilters(plan)

    return sql`
      select distinct payload_keys.field
      from ${trackableApiUsageEvents}
      inner join ${apiKeys}
        on ${trackableApiUsageEvents.apiKeyId} = ${apiKeys.id}
      cross join lateral jsonb_object_keys(${trackableApiUsageEvents.payload}) as payload_keys(field)
      where ${filters}
      order by payload_keys.field asc
    `
  }

  async countGroupedRows(plan: UsageEventExecutionPlan) {
    const result = await this.requireDatabase().execute(
      this.buildCountGroupedRowsQuery(plan)
    )
    const rows = result.rows as Array<{ count: string | number }>

    return Number(rows[0]?.count ?? 0)
  }

  buildCountGroupedRowsQuery(plan: UsageEventExecutionPlan) {
    const aggregateField = plan.aggregateField

    if (!aggregateField) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Grouped usage event queries require an aggregate field.",
      })
    }

    const filters = this.buildFilters(plan)
    const groupJsonValueSql = this.buildJsonValueSql(
      trackableApiUsageEvents.payload,
      [aggregateField]
    )
    const groupIdentitySql = sql<string>`coalesce(${groupJsonValueSql}::text, ${MISSING_GROUP_IDENTITY})`

    return this.queryBuilder
      .select({
        count: sql<number>`count(distinct ${groupIdentitySql})`.as("count"),
      })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(filters)
  }

  private buildFilters(plan: UsageEventExecutionPlan) {
    const filters: SqlValue[] = [
      eq(trackableApiUsageEvents.trackableId, plan.input.trackableId),
    ]

    if (plan.input.from) {
      filters.push(
        gte(trackableApiUsageEvents.occurredAt, new Date(plan.input.from))
      )
    }

    if (plan.input.to) {
      filters.push(
        lte(trackableApiUsageEvents.occurredAt, new Date(plan.input.to))
      )
    }

    const expressionSql = this.buildExpressionSql(plan.filterExpression)

    if (expressionSql) {
      filters.push(expressionSql)
    }

    return and(...filters)!
  }

  private buildExpressionSql(
    expression: UsageEventCompiledExpression
  ): SQL<unknown> | null {
    switch (expression.kind) {
      case "empty":
        return null
      case "logical": {
        const left = this.buildExpressionSql(expression.left)
        const right = this.buildExpressionSql(expression.right)

        if (!left) return right
        if (!right) return left

        return expression.operator === "and"
          ? and(left, right)!
          : or(left, right)!
      }
      case "not": {
        const operand = this.buildExpressionSql(expression.operand)
        return operand ? sql`not (${operand})` : null
      }
      case "comparison":
        return this.buildComparisonPredicate(
          expression.field,
          expression.operator,
          expression.value,
          expression.quoted
        )
      case "range":
        return this.buildRangePredicate(
          expression.field,
          expression.min,
          expression.minInclusive,
          expression.max,
          expression.maxInclusive
        )
      case "regex":
        return this.buildRegexPredicate(expression.field, expression.value)
      default:
        return assertNever(expression)
    }
  }

  private buildComparisonPredicate(
    field: UsageEventSqlField,
    operator: "match" | "eq" | "gt" | "gte" | "lt" | "lte",
    value: string | number | boolean | null,
    quoted: boolean
  ) {
    switch (operator) {
      case "match":
        return this.buildMatchPredicate(field, value, quoted)
      case "eq":
        return this.buildEqualityPredicate(field, value)
      case "gt":
        if (typeof value !== "number") {
          throw invalidNumericComparisonError()
        }
        return this.buildNumericPredicate(
          field,
          (numericSql) => sql`${numericSql} > ${value}`
        )
      case "gte":
        if (typeof value !== "number") {
          throw invalidNumericComparisonError()
        }
        return this.buildNumericPredicate(
          field,
          (numericSql) => sql`${numericSql} >= ${value}`
        )
      case "lt":
        if (typeof value !== "number") {
          throw invalidNumericComparisonError()
        }
        return this.buildNumericPredicate(
          field,
          (numericSql) => sql`${numericSql} < ${value}`
        )
      case "lte":
        if (typeof value !== "number") {
          throw invalidNumericComparisonError()
        }
        return this.buildNumericPredicate(
          field,
          (numericSql) => sql`${numericSql} <= ${value}`
        )
      default:
        return assertNever(operator)
    }
  }

  private buildEqualityPredicate(
    field: UsageEventSqlField,
    value: string | number | boolean | null
  ) {
    if (field.kind === "implicit") {
      return this.buildImplicitEqualityPredicate(value)
    }

    if (value === null) {
      return this.buildExplicitNullPredicate(field)
    }

    if (typeof value === "number") {
      return this.buildNumericPredicate(
        field,
        (numericSql) => sql`${numericSql} = ${value}`
      )
    }

    if (field.kind === "occurredAt" || field.kind === "apiKey") {
      const textSql = this.buildFieldTextSql(field)
      return sql`${textSql} = ${String(value)}`
    }

    const jsonValueSql = this.buildFieldJsonValueSql(field)

    if (!jsonValueSql) {
      return sql`false`
    }

    return this.buildJsonScalarEqualityPredicate(jsonValueSql, value)
  }

  private buildMatchPredicate(
    field: UsageEventSqlField,
    value: string | number | boolean | null,
    quoted: boolean
  ) {
    if (field.kind === "implicit") {
      return this.buildImplicitMatchPredicate(value, quoted)
    }

    if (value === null) {
      return this.buildExplicitNullPredicate(field)
    }

    if (typeof value === "boolean") {
      const textSql = this.buildFieldTextSql(field)
      return sql`${textSql} = ${String(value)}`
    }

    const matcher = buildPatternMatcher(String(value), quoted)
    return this.buildTextRegexPredicate(this.buildFieldTextSql(field), matcher)
  }

  private buildRangePredicate(
    field: UsageEventSqlField,
    min: number,
    minInclusive: boolean,
    max: number,
    maxInclusive: boolean
  ) {
    const minOperator = minInclusive ? sql.raw(">=") : sql.raw(">")
    const maxOperator = maxInclusive ? sql.raw("<=") : sql.raw("<")

    return this.buildNumericPredicate(
      field,
      (numericSql) =>
        sql`${numericSql} ${minOperator} ${min} and ${numericSql} ${maxOperator} ${max}`
    )
  }

  private buildRegexPredicate(field: UsageEventSqlField, value: string) {
    const matcher = buildRegexMatcher(value)

    if (field.kind === "implicit") {
      return this.buildImplicitRegexPredicate(matcher)
    }

    return this.buildTextRegexPredicate(this.buildFieldTextSql(field), matcher)
  }

  private buildImplicitEqualityPredicate(
    value: string | number | boolean | null
  ) {
    if (value === null) {
      return this.buildImplicitJsonScalarSearchSql(
        (jsonValueSql) =>
          sql`${jsonValueSql} is not null and jsonb_typeof(${jsonValueSql}) = 'null'`
      )!
    }

    if (typeof value === "number") {
      return this.buildImplicitJsonScalarSearchSql((jsonValueSql) =>
        this.buildJsonNumberPredicate(
          jsonValueSql,
          (numericSql) => sql`${numericSql} = ${value}`
        )
      )!
    }

    return or(
      sql`${this.buildOccurredAtTextSql()} = ${String(value)}`,
      sql`${this.buildApiKeyIdTextSql()} = ${String(value)}`,
      sql`${apiKeys.name} = ${String(value)}`,
      this.buildImplicitJsonScalarSearchSql((jsonValueSql) =>
        this.buildJsonScalarEqualityPredicate(jsonValueSql, value)
      )
    )!
  }

  private buildNumericPredicate(
    field: UsageEventSqlField,
    buildPredicate: (numericSql: SqlValue) => SQL<unknown>
  ) {
    if (field.kind === "implicit") {
      return this.buildImplicitJsonScalarSearchSql((jsonValueSql) =>
        this.buildJsonNumberPredicate(jsonValueSql, buildPredicate)
      )
    }

    const jsonValueSql = this.buildFieldJsonValueSql(field)

    if (!jsonValueSql) {
      throw invalidNumericComparisonError()
    }

    return this.buildJsonNumberPredicate(jsonValueSql, buildPredicate)
  }

  private buildExplicitNullPredicate(field: UsageEventSqlField) {
    if (field.kind === "occurredAt") {
      return sql`false`
    }

    if (field.kind === "apiKey") {
      const textSql = this.buildFieldTextSql(field)
      return sql`${textSql} is null`
    }

    const jsonValueSql = this.buildFieldJsonValueSql(field)

    if (!jsonValueSql) {
      return sql`false`
    }

    return sql`${jsonValueSql} is not null and jsonb_typeof(${jsonValueSql}) = 'null'`
  }

  private buildImplicitMatchPredicate(
    value: string | number | boolean | null,
    quoted: boolean
  ) {
    if (value === null) {
      return this.buildImplicitJsonScalarSearchSql(
        (jsonValueSql) =>
          sql`${jsonValueSql} is not null and jsonb_typeof(${jsonValueSql}) = 'null'`
      )!
    }

    if (typeof value === "boolean") {
      return or(
        sql`${this.buildOccurredAtTextSql()} = ${String(value)}`,
        sql`${this.buildApiKeyIdTextSql()} = ${String(value)}`,
        sql`${apiKeys.name} = ${String(value)}`,
        this.buildImplicitJsonScalarSearchSql(
          (_jsonValueSql, textSql) => sql`${textSql} = ${String(value)}`
        )
      )!
    }

    const matcher = buildPatternMatcher(String(value), quoted)
    return this.buildImplicitRegexPredicate(matcher)
  }

  private buildImplicitRegexPredicate(matcher: RegexMatcher) {
    return or(
      this.buildTextRegexPredicate(this.buildOccurredAtTextSql(), matcher),
      this.buildTextRegexPredicate(this.buildApiKeyIdTextSql(), matcher),
      this.buildTextRegexPredicate(sql`${apiKeys.name}`, matcher),
      this.buildImplicitJsonScalarSearchSql((_jsonValueSql, textSql) =>
        this.buildTextRegexPredicate(textSql, matcher)
      )
    )!
  }

  private buildImplicitJsonScalarSearchSql(
    buildPredicate: (
      jsonValueSql: SqlValue,
      textSql: SQL<string | null>
    ) => SQL<unknown>
  ) {
    const aliasSql = sql.raw("json_values.value")
    const textSql = this.buildScalarTextSql(aliasSql)

    return sql`
      exists (
        with recursive json_values(value) as (
          select ${trackableApiUsageEvents.payload}
          union all
          select ${trackableApiUsageEvents.metadata}
          union all
          select child.value
          from json_values
          cross join lateral (
            select array_child.value
            from jsonb_array_elements(
              case
                when jsonb_typeof(json_values.value) = 'array'
                  then json_values.value
                else ${EMPTY_JSON_ARRAY_SQL}
              end
            ) as array_child(value)
            union all
            select object_child.value
            from jsonb_each(
              case
                when jsonb_typeof(json_values.value) = 'object'
                  then json_values.value
                else ${EMPTY_JSON_OBJECT_SQL}
              end
            ) as object_child(key, value)
          ) as child(value)
        )
        select 1
        from json_values
        where jsonb_typeof(json_values.value) is distinct from 'object'
          and jsonb_typeof(json_values.value) is distinct from 'array'
          and ${buildPredicate(aliasSql, textSql)}
      )
    `
  }

  private buildJsonNumberPredicate(
    jsonValueSql: SqlValue,
    buildPredicate: (numericSql: SqlValue) => SQL<unknown>
  ) {
    const numericSql = sql<number>`(${this.buildScalarTextSql(jsonValueSql)})::numeric`

    return sql`
      ${jsonValueSql} is not null
      and jsonb_typeof(${jsonValueSql}) = 'number'
      and ${buildPredicate(numericSql)}
    `
  }

  private buildJsonScalarEqualityPredicate(
    jsonValueSql: SqlValue,
    value: string | boolean
  ) {
    const expectedType = typeof value === "boolean" ? "boolean" : "string"
    const textValueSql = sql<
      string | null
    >`(${jsonValueSql}) #>> ${JSON_ROOT_PATH_SQL}`

    return sql`
      ${jsonValueSql} is not null
      and jsonb_typeof(${jsonValueSql}) = ${expectedType}
      and ${textValueSql} = ${String(value)}
    `
  }

  private buildFieldJsonValueSql(field: UsageEventSqlField) {
    switch (field.kind) {
      case "payload":
        return this.buildJsonValueSql(
          trackableApiUsageEvents.payload,
          field.path
        )
      case "metadata":
        return field.path.length === 0
          ? sql`${trackableApiUsageEvents.metadata}`
          : this.buildJsonValueSql(trackableApiUsageEvents.metadata, field.path)
      default:
        return null
    }
  }

  private buildFieldTextSql(field: UsageEventSqlField) {
    switch (field.kind) {
      case "occurredAt":
        return this.buildOccurredAtTextSql()
      case "apiKey":
        return field.key === "id"
          ? this.buildApiKeyIdTextSql()
          : sql`${apiKeys.name}`
      case "payload":
      case "metadata": {
        const jsonValueSql = this.buildFieldJsonValueSql(field)
        return this.buildScalarTextSql(jsonValueSql!)
      }
      case "implicit":
        throw new Error("Implicit fields must be handled separately.")
      default:
        return assertNever(field)
    }
  }

  private buildApiKeyIdTextSql() {
    return sql<string>`${apiKeys.id}::text`
  }

  private buildOccurredAtTextSql() {
    return sql<string>`to_char(${trackableApiUsageEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
  }

  private buildJsonValueSql(baseJsonSql: SqlValue, path: string[]) {
    if (path.length === 0) {
      return sql`(${baseJsonSql})`
    }

    return sql`(${baseJsonSql} #> ${this.buildJsonPathArraySql(path)})`
  }

  private buildScalarTextSql(
    jsonValueSql: SqlValue,
    options?: { normalizeBlankString?: boolean }
  ) {
    const wrappedJsonValueSql = sql`(${jsonValueSql})`
    const scalarTextSql = sql<
      string | null
    >`${wrappedJsonValueSql} #>> ${JSON_ROOT_PATH_SQL}`
    const maybeNormalizedTextSql = options?.normalizeBlankString
      ? sql<string | null>`nullif(btrim(${scalarTextSql}), '')`
      : scalarTextSql

    return sql<string | null>`
      case
        when ${wrappedJsonValueSql} is null then null
        when jsonb_typeof(${wrappedJsonValueSql}) = 'null' then null
        when jsonb_typeof(${wrappedJsonValueSql}) in ('string', 'number', 'boolean')
          then ${maybeNormalizedTextSql}
        else (${wrappedJsonValueSql})::text
      end
    `
  }

  private buildDisplayTextSql(jsonValueSql: SqlValue) {
    return sql<
      string | null
    >`coalesce(${this.buildScalarTextSql(jsonValueSql, { normalizeBlankString: true })}, '')`
  }

  private buildJsonPathArraySql(path: string[]) {
    return sql`ARRAY[${sql.join(
      path.map((segment) => sql`${segment}`),
      sql`, `
    )}]::text[]`
  }

  private buildTextRegexPredicate(textSql: SqlValue, matcher: RegexMatcher) {
    return sql`${textSql} is not null and ${textSql} ~ ${matcher.pattern}`
  }

  private buildFlatRowSelection(eventSortValueSql: SQL<string | null>) {
    return {
      apiKeyId: sql<string>`${apiKeys.id}`.as("api_key_id"),
      apiKeyLastFour: sql<string>`${apiKeys.lastFour}`.as("api_key_last_four"),
      apiKeyName: sql<string>`${apiKeys.name}`.as("api_key_name"),
      apiKeyPrefix: sql<string>`${apiKeys.keyPrefix}`.as("api_key_prefix"),
      id: sql<string>`${trackableApiUsageEvents.id}`.as("id"),
      metadata: sql`${trackableApiUsageEvents.metadata}`.as("metadata"),
      occurredAt: sql<Date>`${trackableApiUsageEvents.occurredAt}`.as(
        "occurred_at"
      ),
      payload: sql<
        Record<string, unknown>
      >`${trackableApiUsageEvents.payload}`.as("payload"),
      sortValue: eventSortValueSql.as("sort_value"),
    }
  }

  private buildFlatCursorFilter(
    plan: UsageEventExecutionPlan,
    cursor: FlatCursor | null,
    eventSortValueSql: SQL<string | null>
  ) {
    if (!cursor) {
      return undefined
    }

    if (plan.input.sort === "event") {
      const sortValue = cursor.sortValue ?? ""

      return this.buildKeysetWhere([
        {
          direction: plan.input.dir,
          expression: sql<string>`coalesce(${eventSortValueSql}, '')`,
          value: sortValue,
        },
        {
          direction: plan.input.dir,
          expression: trackableApiUsageEvents.occurredAt,
          value: new Date(cursor.occurredAt),
        },
        {
          direction: plan.input.dir,
          expression: trackableApiUsageEvents.id,
          value: cursor.id,
        },
      ])
    }

    return this.buildKeysetWhere([
      {
        direction: plan.input.dir,
        expression: trackableApiUsageEvents.occurredAt,
        value: new Date(cursor.occurredAt),
      },
      {
        direction: plan.input.dir,
        expression: trackableApiUsageEvents.id,
        value: cursor.id,
      },
    ])
  }

  private buildFlatOrderBy(
    plan: UsageEventExecutionPlan,
    eventSortValueSql: SQL<string | null>
  ) {
    if (plan.input.sort === "event") {
      return plan.input.dir === "asc"
        ? [
            asc(sql<string>`coalesce(${eventSortValueSql}, '')`),
            asc(trackableApiUsageEvents.occurredAt),
            asc(trackableApiUsageEvents.id),
          ]
        : [
            desc(sql<string>`coalesce(${eventSortValueSql}, '')`),
            desc(trackableApiUsageEvents.occurredAt),
            desc(trackableApiUsageEvents.id),
          ]
    }

    return plan.input.dir === "asc"
      ? [
          asc(trackableApiUsageEvents.occurredAt),
          asc(trackableApiUsageEvents.id),
        ]
      : [
          desc(trackableApiUsageEvents.occurredAt),
          desc(trackableApiUsageEvents.id),
        ]
  }

  private buildGroupedSubquery(
    plan: UsageEventExecutionPlan,
    aggregateField: string
  ) {
    const groupedSource = this.buildGroupedSourceSubquery(plan, aggregateField)
    const groupValueSql = sql<string | null>`max(${groupedSource.groupValue})`
    const sortValueSql = sql<string>`coalesce(${groupValueSql}, '')`
    const apiKeysJsonSql = sql<UsageEventRecord["apiKey"][]>`
      coalesce(
        jsonb_agg(
          distinct jsonb_build_object(
            'id', ${groupedSource.apiKeyId},
            'name', ${groupedSource.apiKeyName},
            'maskedKey', ${groupedSource.apiKeyPrefix} || '...' || ${groupedSource.apiKeyLastFour}
          )
        ) filter (where ${groupedSource.apiKeyId} is not null),
        '[]'::jsonb
      )
    `

    return this.queryBuilder
      .select({
        apiKeys: apiKeysJsonSql.as("api_keys"),
        firstOccurredAt: sql<Date>`min(${groupedSource.occurredAt})`.as(
          "first_occurred_at"
        ),
        groupIdentity: groupedSource.groupIdentity,
        groupValue: groupValueSql.as("group_value"),
        lastOccurredAt: sql<Date>`max(${groupedSource.occurredAt})`.as(
          "last_occurred_at"
        ),
        sortValue: sortValueSql.as("sort_value"),
        totalHits: count().as("total_hits"),
      })
      .from(groupedSource)
      .groupBy(groupedSource.groupIdentity)
      .as("usage_event_groups")
  }

  private buildGroupedSourceSubquery(
    plan: UsageEventExecutionPlan,
    aggregateField: string
  ) {
    const filters = this.buildFilters(plan)
    const groupJsonValueSql = this.buildJsonValueSql(
      trackableApiUsageEvents.payload,
      [aggregateField]
    )
    const groupIdentitySql = sql<string>`coalesce(${groupJsonValueSql}::text, ${MISSING_GROUP_IDENTITY})`
    const groupValueSql = this.buildScalarTextSql(groupJsonValueSql, {
      normalizeBlankString: true,
    })

    return this.queryBuilder
      .select({
        apiKeyId: apiKeys.id,
        apiKeyLastFour: apiKeys.lastFour,
        apiKeyName: apiKeys.name,
        apiKeyPrefix: apiKeys.keyPrefix,
        groupIdentity: groupIdentitySql.as("group_identity"),
        groupValue: groupValueSql.as("group_value"),
        occurredAt: trackableApiUsageEvents.occurredAt,
      })
      .from(trackableApiUsageEvents)
      .innerJoin(apiKeys, eq(trackableApiUsageEvents.apiKeyId, apiKeys.id))
      .where(filters)
      .as("usage_event_group_source")
  }

  private buildGroupedCursorFilter(
    plan: UsageEventExecutionPlan,
    cursor: GroupedCursor | null,
    groupedSubquery: ReturnType<UsageEventSqlRepository["buildGroupedSubquery"]>
  ) {
    if (!cursor) {
      return undefined
    }

    if (plan.input.sort === "totalHits") {
      return this.buildKeysetWhere([
        {
          direction: plan.input.dir,
          expression: groupedSubquery.totalHits,
          value: Number(cursor.sortValue),
        },
        {
          direction: plan.input.dir,
          expression: groupedSubquery.groupIdentity,
          value: cursor.groupIdentity,
        },
      ])
    }

    if (plan.input.sort === "event") {
      return this.buildKeysetWhere([
        {
          direction: plan.input.dir,
          expression: groupedSubquery.sortValue,
          value: String(cursor.sortValue),
        },
        {
          direction: plan.input.dir,
          expression: groupedSubquery.groupIdentity,
          value: cursor.groupIdentity,
        },
      ])
    }

    return this.buildKeysetWhere([
      {
        direction: plan.input.dir,
        expression: groupedSubquery.lastOccurredAt,
        value: new Date(String(cursor.sortValue)),
      },
      {
        direction: plan.input.dir,
        expression: groupedSubquery.groupIdentity,
        value: cursor.groupIdentity,
      },
    ])
  }

  private buildGroupedOrderBy(
    plan: UsageEventExecutionPlan,
    groupedSubquery: ReturnType<UsageEventSqlRepository["buildGroupedSubquery"]>
  ) {
    switch (plan.input.sort) {
      case "event":
        return plan.input.dir === "asc"
          ? [asc(groupedSubquery.sortValue), asc(groupedSubquery.groupIdentity)]
          : [
              desc(groupedSubquery.sortValue),
              desc(groupedSubquery.groupIdentity),
            ]
      case "totalHits":
        return plan.input.dir === "asc"
          ? [asc(groupedSubquery.totalHits), asc(groupedSubquery.groupIdentity)]
          : [
              desc(groupedSubquery.totalHits),
              desc(groupedSubquery.groupIdentity),
            ]
      case "lastOccurredAt":
      default:
        return plan.input.dir === "asc"
          ? [
              asc(groupedSubquery.lastOccurredAt),
              asc(groupedSubquery.groupIdentity),
            ]
          : [
              desc(groupedSubquery.lastOccurredAt),
              desc(groupedSubquery.groupIdentity),
            ]
    }
  }

  private buildKeysetWhere(
    terms: Array<{
      direction: "asc" | "desc"
      expression: SqlValue
      value: Date | number | string
    }>
  ) {
    const branches = terms.map((term, index) => {
      const equals = terms
        .slice(0, index)
        .map((priorTerm) => sql`${priorTerm.expression} = ${priorTerm.value}`)
      const comparison =
        term.direction === "asc"
          ? sql`${term.expression} > ${term.value}`
          : sql`${term.expression} < ${term.value}`

      return and(...equals, comparison)!
    })

    return or(...branches)!
  }

  private mapFlatRow(row: {
    apiKeyId: string
    apiKeyLastFour: string
    apiKeyName: string
    apiKeyPrefix: string
    id: string
    metadata: unknown
    occurredAt: Date
    payload: Record<string, unknown>
  }) {
    return {
      apiKey: {
        id: row.apiKeyId,
        maskedKey: `${row.apiKeyPrefix}...${row.apiKeyLastFour}`,
        name: row.apiKeyName,
      },
      id: row.id,
      metadata: normalizeUsageEventMetadata(row.metadata),
      occurredAt: row.occurredAt,
      payload: row.payload,
    } satisfies UsageEventRecord
  }

  private normalizeFlatQueryRow(row: Record<string, unknown>) {
    return {
      apiKeyId: this.readRequiredString(row, "apiKeyId", "api_key_id"),
      apiKeyLastFour: this.readRequiredString(
        row,
        "apiKeyLastFour",
        "api_key_last_four"
      ),
      apiKeyName: this.readRequiredString(row, "apiKeyName", "api_key_name"),
      apiKeyPrefix: this.readRequiredString(
        row,
        "apiKeyPrefix",
        "api_key_prefix"
      ),
      id: this.readRequiredString(row, "id"),
      metadata: row.metadata ?? null,
      occurredAt: this.readRequiredDate(row, "occurredAt", "occurred_at"),
      payload: (row.payload ?? {}) as Record<string, unknown>,
      sortValue: this.readOptionalString(row, "sortValue", "sort_value"),
    }
  }

  private normalizeGroupedQueryRow(row: Record<string, unknown>) {
    return {
      apiKeys:
        (this.readValue(
          row,
          "apiKeys",
          "api_keys"
        ) as UsageEventRecord["apiKey"][]) ?? [],
      firstOccurredAt: this.readRequiredDate(
        row,
        "firstOccurredAt",
        "first_occurred_at"
      ),
      groupIdentity: this.readRequiredString(
        row,
        "groupIdentity",
        "group_identity"
      ),
      groupValue: this.readOptionalString(row, "groupValue", "group_value"),
      lastOccurredAt: this.readRequiredDate(
        row,
        "lastOccurredAt",
        "last_occurred_at"
      ),
      sortValue: this.readOptionalString(row, "sortValue", "sort_value"),
      totalHits: Number(this.readValue(row, "totalHits", "total_hits") ?? 0),
    }
  }

  private readRequiredDate(row: Record<string, unknown>, ...keys: string[]) {
    const value = this.readValue(row, ...keys)

    if (!value || (typeof value !== "string" && !(value instanceof Date))) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Usage event query returned an invalid date column.",
      })
    }

    return normalizeDateValue(value)
  }

  private readRequiredString(row: Record<string, unknown>, ...keys: string[]) {
    const value = this.readValue(row, ...keys)

    if (typeof value !== "string") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Usage event query returned an invalid string column.",
      })
    }

    return value
  }

  private readOptionalString(row: Record<string, unknown>, ...keys: string[]) {
    const value = this.readValue(row, ...keys)

    return typeof value === "string" ? value : null
  }

  private readValue(row: Record<string, unknown>, ...keys: string[]) {
    for (const key of keys) {
      if (key in row) {
        return row[key]
      }
    }

    return undefined
  }

  private decodeCursor<T>(cursor: string | null) {
    if (!cursor) {
      return null
    }

    try {
      return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid usage event cursor.",
      })
    }
  }

  private encodeCursor<T>(cursor: T) {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
  }

  private requirePageSize(plan: UsageEventExecutionPlan) {
    if (typeof plan.input.pageSize === "number") {
      return plan.input.pageSize
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Usage event page size is required.",
    })
  }

  private requireDatabase() {
    if (!this.database) {
      throw new Error("UsageEventSqlRepository requires a database adapter.")
    }

    return this.database
  }
}

type RegexMatcher = {
  pattern: string
}

function buildPatternMatcher(value: string, quoted: boolean): RegexMatcher {
  if (!quoted && (value.includes("*") || value.includes("?"))) {
    return {
      pattern: `(?i)${convertWildcardToRegexPattern(value)}`,
    }
  }

  return {
    pattern: `${quoted ? "" : "(?i)"}${escapeRegex(value)}`,
  }
}

function buildRegexMatcher(value: string): RegexMatcher {
  const match = /^(\/?)(.+)\1([a-z]*)$/.exec(value)

  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid regex expression.",
    })
  }

  const flags = match[3] ?? ""
  const supportedFlags = flags
    .split("")
    .filter((flag) => ["i", "m", "s", "x"].includes(flag))
    .join("")

  return {
    pattern: `${supportedFlags ? `(?${supportedFlags})` : ""}${match[2]}`,
  }
}

function convertWildcardToRegexPattern(value: string) {
  return value.replaceAll(/(\*+)|(\?)/g, (_match, stars) =>
    stars ? "(.+?)" : "(.)"
  )
}

function escapeRegex(value: string) {
  return value.replaceAll(/[|\\{}()[\]^$+*?.]/g, "\\$&")
}

function invalidNumericComparisonError() {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: "Numeric comparison operators require numeric fields and values.",
  })
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}
