/**
 * better-auth schema tables
 *
 * These tables are managed by better-auth. Do not edit manually.
 * Core tables: user, session, account, verification
 * OAuth 2.1 provider tables: oauthClient, oauthAccessToken, oauthRefreshToken, oauthConsent
 */

import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Core better-auth tables
// ---------------------------------------------------------------------------

export const user = pgTable("auth_users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  lastLoginMethod: text(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const session = pgTable("auth_sessions", {
  id: text().primaryKey(),
  expiresAt: timestamp({ mode: "date", withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("auth_accounts", {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ mode: "date", withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ mode: "date", withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const verification = pgTable("auth_verifications", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ mode: "date", withTimezone: true }).notNull(),
  createdAt: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
})

// ---------------------------------------------------------------------------
// OAuth 2.1 provider plugin tables (@better-auth/oauth-provider)
// ---------------------------------------------------------------------------

export const oauthClient = pgTable("oauth_clients", {
  id: text().primaryKey(),
  clientId: text().notNull().unique(),
  clientSecret: text(),
  disabled: boolean().default(false),
  skipConsent: boolean(),
  enableEndSession: boolean(),
  subjectType: text(),
  scopes: text().array(),
  userId: text().references(() => user.id, { onDelete: "set null" }),
  referenceId: text(),
  createdAt: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  name: text(),
  uri: text(),
  icon: text(),
  contacts: text().array(),
  tos: text(),
  policy: text(),
  softwareId: text(),
  softwareVersion: text(),
  softwareStatement: text(),
  redirectUris: text().array().notNull(),
  postLogoutRedirectUris: text().array(),
  tokenEndpointAuthMethod: text(),
  grantTypes: text().array(),
  responseTypes: text().array(),
  public: boolean(),
  type: text(),
  requirePKCE: boolean(),
  metadata: text(),
})

export const oauthRefreshToken = pgTable("oauth_refresh_tokens", {
  id: text().primaryKey(),
  token: text().unique(),
  clientId: text()
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: text().references(() => session.id, { onDelete: "set null" }),
  userId: text().references(() => user.id, { onDelete: "cascade" }),
  referenceId: text(),
  scopes: text().array().notNull(),
  revoked: timestamp({ mode: "date", withTimezone: true }),
  authTime: timestamp({ mode: "date", withTimezone: true }),
  expiresAt: timestamp({ mode: "date", withTimezone: true }),
  createdAt: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
})

export const oauthAccessToken = pgTable("oauth_access_tokens", {
  id: text().primaryKey(),
  token: text().unique(),
  clientId: text()
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: text().references(() => session.id, { onDelete: "set null" }),
  refreshId: text().references(() => oauthRefreshToken.id, {
    onDelete: "cascade",
  }),
  userId: text().references(() => user.id, { onDelete: "cascade" }),
  referenceId: text(),
  scopes: text().array().notNull(),
  expiresAt: timestamp({ mode: "date", withTimezone: true }),
  createdAt: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
})

export const oauthConsent = pgTable("oauth_consents", {
  id: text().primaryKey(),
  clientId: text()
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  userId: text().references(() => user.id, { onDelete: "cascade" }),
  referenceId: text(),
  scopes: text().array().notNull(),
  createdAt: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
})

// ---------------------------------------------------------------------------
// JWT plugin table (required peer for @better-auth/oauth-provider)
// ---------------------------------------------------------------------------

export const jwks = pgTable("auth_jwks", {
  id: text().primaryKey(),
  publicKey: text().notNull(),
  privateKey: text().notNull(),
  createdAt: timestamp({ mode: "date", withTimezone: true }).notNull(),
  expiresAt: timestamp({ mode: "date", withTimezone: true }),
})
