import { resolve } from "node:path"

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

const { Pool } = pg

async function main() {
	const connectionString = process.env.DATABASE_URL

	if (!connectionString) {
		throw new Error("DATABASE_URL is required to run database migrations.")
	}

	const pool = new Pool({ connectionString })
	const db = drizzle(pool)

	try {
		const migrationsFolder = resolve(process.cwd(), "drizzle")
		await migrate(db, { migrationsFolder })
		console.log(`Applied migrations from ${migrationsFolder}.`)
	} finally {
		await pool.end()
	}
}

main().catch((error) => {
	console.error("Failed to run database migrations.")
	console.error(error)
	process.exit(1)
})
