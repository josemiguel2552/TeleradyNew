/* eslint-disable no-console */
/**
 * Bootstraps the first admin user.
 *
 * Usage:
 *   npm run seed:admin -- --email=admin@telerady.es --password='S3curePass!2024'
 *
 * Reads DATABASE_URL from the environment (same .env file the API uses).
 * The user is created idempotently: if the email already exists, the role
 * assignment is upserted but the password is left untouched.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import {
  appUserInTelerady,
  userRoleAssignmentInTelerady,
} from '../database/schema';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const email = (args.email ?? process.env.SEED_ADMIN_EMAIL ?? '').toLowerCase().trim();
  const password = args.password ?? process.env.SEED_ADMIN_PASSWORD ?? '';
  const role = (args.role ?? 'admin').trim();

  if (!email || !password) {
    console.error(
      'Missing --email or --password. Example:\n' +
        '  npm run seed:admin -- --email=admin@telerady.es --password=...',
    );
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Refusing to seed an admin with a password under 12 characters.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const db = drizzle(dbUrl);

  const existing = await db
    .select({ id: appUserInTelerady.id })
    .from(appUserInTelerady)
    .where(eq(appUserInTelerady.email, email))
    .limit(1);

  let userId: string;
  if (existing.length) {
    userId = existing[0].id;
    console.log(`User ${email} already exists (id=${userId}); ensuring role only.`);
  } else {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 64 * 1024,
      timeCost: 3,
      parallelism: 4,
    });
    const [row] = await db
      .insert(appUserInTelerady)
      .values({ email, passwordHash })
      .returning({ id: appUserInTelerady.id });
    userId = row.id;
    console.log(`Created user ${email} (id=${userId}).`);
  }

  await db
    .insert(userRoleAssignmentInTelerady)
    .values({ userId, role })
    .onConflictDoNothing();
  console.log(`Role ${role} ensured.`);

  process.exit(0);
}

main().catch((err) => {
  console.error('seed:admin failed:', err);
  process.exit(1);
});
