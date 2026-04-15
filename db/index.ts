// import "server-only"

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "@/db/schema"
import { getLogger, getSanitizedPostgresTarget } from "@/lib/logger"

const logger = getLogger("postgres")
const databaseTarget = getSanitizedPostgresTarget()

function buildSslConfig() {
  const mode = process.env.DATABASE_SSL_MODE
  if (!mode || mode === "disable") return undefined
  return {
    rejectUnauthorized:
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
  }
}

// Derives a connection string for a named role using the same host/database as
// DATABASE_URL but with the given username and BETTER_AUTH_SECRET as password.
function buildRoleConnectionString(roleName: string): string {
  const base = process.env.DATABASE_URL
  if (!base) return ""
  const u = new URL(base)
  u.username = roleName
  u.password = process.env.BETTER_AUTH_SECRET ?? ""
  return u.toString()
}

const ssl = buildSslConfig()

// Worker pool: BYPASSRLS, DML only — used by background jobs, auth, and
// internal services that legitimately need cross-tenant data access.
const pool = new Pool({
  connectionString: buildRoleConnectionString("trackables_worker"),
  ssl,
})

// App pool: strict RLS enforced — used exclusively by withUserContext() for
// user-facing requests where per-tenant isolation must be guaranteed.
const appPool = new Pool({
  connectionString: buildRoleConnectionString("trackables_app"),
  ssl,
})

function makeErrorHandler(poolName: string) {
  return (err: Error) => {
    logger.error(
      {
        err,
        target: databaseTarget,
        lifecycle: "error",
        pool: poolName,
      },
      "PostgreSQL pool error.",
    )
  }
}

pool.on("error", makeErrorHandler("worker"))
appPool.on("error", makeErrorHandler("app"))

export const db = drizzle(pool, { schema, casing: "snake_case" })

// Runs fn inside a transaction on a dedicated trackables_app connection, with
// the current user ID set as a transaction-local setting. RLS policies read
// this setting to enforce per-tenant isolation. Using set_config with
// is_local=true ensures the setting is scoped to the transaction and never
// leaks to the next pool requester.
export async function withUserContext<T>(
  userId: string,
  fn: (db: NodePgDatabase<typeof schema>) => T,
): Promise<Awaited<T>> {
  // No DATABASE_URL means we're in a test environment with a mocked db.
  // Fall through to fn(db) so unit tests can exercise business logic
  // without a live PostgreSQL connection.
  if (!process.env.DATABASE_URL) {
    return fn(db) as Awaited<T>
  }

  const client = await appPool.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [userId],
    )
    const contextDb = drizzle(client, {
      schema,
      casing: "snake_case",
    }) as unknown as typeof db
    const result = await fn(contextDb)
    await client.query("COMMIT")
    return result
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}
