import { sql } from "drizzle-orm"
import { integer, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

export function uuidPrimaryKey() {
  return uuid().defaultRandom().primaryKey()
}

export function createdAt() {
  return timestamp({ mode: "date", withTimezone: true })
    .defaultNow()
    .notNull()
}

export function updatedAt() {
  return timestamp({ mode: "date", withTimezone: true })
    .defaultNow()
    .notNull()
}

export function archivedAt() {
  return timestamp({ mode: "date", withTimezone: true })
}

export function revokedAt() {
  return timestamp({ mode: "date", withTimezone: true })
}

export function expiresAt() {
  return timestamp({ mode: "date", withTimezone: true })
}

export function occurredAt() {
  return timestamp({ mode: "date", withTimezone: true })
    .defaultNow()
    .notNull()
}

export function nullableTimestamp() {
  return timestamp({ mode: "date", withTimezone: true })
}

export function lastSeenAt() {
  return nullableTimestamp()
}

export function sortOrder() {
  return integer().default(0).notNull()
}

export function usageCount() {
  return integer().default(0).notNull()
}

export function submissionCount() {
  return integer().default(0).notNull()
}

export function ownerId() {
  return text().notNull()
}

export function createdByUserId() {
  return text().notNull()
}

export function metadataJson<T>() {
  return jsonb()
    .$type<T>()
    .default(sql`'{}'::jsonb`)
    .notNull()
}

export function settingsJson<T>() {
  return jsonb()
    .$type<T>()
    .default(sql`'{}'::jsonb`)
    .notNull()
}

export const timestamps = {
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}
