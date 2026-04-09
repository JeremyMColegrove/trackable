/**
 * One-time migration script: seed auth_users from the existing users table.
 *
 * Run this BEFORE going live with better-auth so that returning users are
 * matched to their existing workspace/trackable data by the same ID.
 *
 * Usage:
 *   npx tsx scripts/seed-auth-users-from-existing.ts
 *
 * Safe to run multiple times (ON CONFLICT DO NOTHING).
 *
 * After running:
 * - Microsoft OAuth users: on first sign-in via Microsoft, better-auth adds an
 *   auth_accounts row linking their Microsoft account to their existing ID.
 * - Email+password users: a row exists in auth_users but no password in
 *   auth_accounts. They must use "Forgot password" to set a new password
 *   (Clerk's password hashes are not exportable).
 */

import "dotenv/config"
import { db } from "../db"
import { users } from "../db/schema"
import { user as authUsers } from "../db/schema/auth"

async function main() {
  console.log("Fetching existing users...")
  const existingUsers = await db
    .select({
      id: users.id,
      email: users.primaryEmail,
      name: users.displayName,
      image: users.imageUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)

  console.log(`Found ${existingUsers.length} users to seed.`)

  let inserted = 0
  let skipped = 0

  for (const u of existingUsers) {
    if (!u.email) {
      console.warn(`  Skipping user ${u.id} — no email address.`)
      skipped++
      continue
    }

    await db
      .insert(authUsers)
      .values({
        id: u.id,
        email: u.email,
        name: u.name ?? u.email,
        emailVerified: true, // treat existing users as verified
        image: u.image ?? null,
        createdAt: u.createdAt ?? new Date(),
        updatedAt: u.updatedAt ?? new Date(),
      })
      .onConflictDoNothing()

    inserted++
    if (inserted % 100 === 0) {
      console.log(`  Inserted ${inserted} so far...`)
    }
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (no email): ${skipped}.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
