import pg from "pg"

const { Client } = pg

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  const secret = process.env.BETTER_AUTH_SECRET

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to set up database roles.")
  }
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required to set up database roles.")
  }

  // Parse admin username from the connection string to use in
  // ALTER DEFAULT PRIVILEGES, which must reference the table-owning role.
  const adminUser = new URL(connectionString).username

  const client = new Client({ connectionString })
  await client.connect()

  try {
    for (const roleName of ["trackables_worker", "trackables_app"]) {
      const quotedRoleName = quoteIdentifier(roleName)
      const { rows } = await client.query(
        "SELECT 1 FROM pg_roles WHERE rolname = $1",
        [roleName],
      )
      if (rows.length === 0) {
        await client.query(
          `CREATE ROLE ${quotedRoleName} WITH LOGIN PASSWORD ${quoteLiteral(secret)}`,
        )
        console.log(`Created role: ${roleName}`)
      } else {
        await client.query(
          `ALTER ROLE ${quotedRoleName} WITH PASSWORD ${quoteLiteral(secret)}`,
        )
        console.log(`Updated password for role: ${roleName}`)
      }
    }

    const dbName = new URL(connectionString).pathname.replace(/^\//, "")

    // Grants applied to both roles
    for (const roleName of ["trackables_worker", "trackables_app"]) {
      const quotedRoleName = quoteIdentifier(roleName)
      await client.query(
        `GRANT CONNECT ON DATABASE ${quoteIdentifier(dbName)} TO ${quotedRoleName}`,
      )
      await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedRoleName}`)
      // Covers tables that already exist (e.g. on container restart after migrations)
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quotedRoleName}`,
      )
      await client.query(
        `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quotedRoleName}`,
      )
      // Auto-grant on tables/sequences created by future migrations
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(adminUser)} IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quotedRoleName}`,
      )
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(adminUser)} IN SCHEMA public
         GRANT USAGE, SELECT ON SEQUENCES TO ${quotedRoleName}`,
      )
    }

    // trackables_worker bypasses RLS so background jobs can see all tenant data
    // without requiring DDL access (BYPASSRLS != superuser).
    await client.query(
      `ALTER ROLE ${quoteIdentifier("trackables_worker")} BYPASSRLS`,
    )

    console.log("Database roles configured successfully.")
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("Failed to set up database roles.")
  console.error(error)
  process.exit(1)
})
