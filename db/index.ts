import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { getLogger, getSanitizedPostgresTarget } from "@/lib/logger";

const logger = getLogger("postgres");
const databaseTarget = getSanitizedPostgresTarget();

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
	logger.error(
		{
			err,
			target: databaseTarget,
			lifecycle: "error",
		},
		"PostgreSQL pool error.",
	);
});

export const db = drizzle(pool, { casing: "snake_case", schema });
