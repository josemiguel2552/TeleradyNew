/* eslint-disable no-console */
/**
 * Push smoke seed.
 *
 * Mounts a fake-but-syntactically-valid push subscription against an
 * existing app_user so the dev can exercise the PushService /
 * sendToUser path without a real browser (Chrome / Firefox / Edge) +
 * PushManager.subscribe roundtrip.
 *
 *   - The endpoint uses the reserved `.invalid` TLD (RFC 2606) so any
 *     real web-push delivery fails fast at DNS without leaking
 *     anything to a third-party. Expect PushService to report
 *     { delivered: 0, reaped: 0, failed: 1 } per call.
 *   - p256dh is a real P-256 public key generated locally with
 *     node:crypto so `web-push` accepts it during payload encryption.
 *     The private side is discarded — there's no decryption flow on
 *     dev anyway.
 *   - auth is 16 random bytes base64url-encoded (the format Chrome
 *     ships).
 *   - The row is upserted on the endpoint key the same way
 *     PushService.subscribe does it, so re-running the seed
 *     resurrects + refreshes instead of duplicating.
 *
 * Defaults to the demo radiologist `pepa@telerady.test` (created by
 * `seed:demo`). Override with --email <addr>.
 *
 * Usage:
 *   npm run seed:push
 *   npm run seed:push -- --email admin@telerady.test
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { createECDH, randomBytes } from 'node:crypto';
import { appUserInTelerady, pushSubscriptionInTelerady } from '../database/schema';

const DEFAULT_EMAIL = 'pepa@telerady.test';

function parseEmail(argv: string[]): string {
  const i = argv.indexOf('--email');
  if (i === -1) return DEFAULT_EMAIL;
  const next = argv[i + 1];
  if (!next) {
    console.error('--email requires a value');
    process.exit(2);
  }
  return next;
}

function generateP256DhKey(): string {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return ecdh.getPublicKey().toString('base64url');
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Missing DATABASE_URL. Run from apps/back with a .env file.');
    process.exit(1);
  }

  const email = parseEmail(process.argv.slice(2));
  const db = drizzle(dbUrl);

  const users = await db
    .select({ id: appUserInTelerady.id })
    .from(appUserInTelerady)
    .where(eq(appUserInTelerady.email, email))
    .limit(1);
  if (!users.length) {
    console.error(`No app_user found for ${email}. Run \`npm run seed:demo\` first.`);
    process.exit(3);
  }
  const userId = users[0].id;

  const endpoint = `https://push.example.invalid/wp/dummy-${userId}`;
  const p256dh = generateP256DhKey();
  const auth = randomBytes(16).toString('base64url');

  const [row] = await db
    .insert(pushSubscriptionInTelerady)
    .values({
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: 'telerady-seed/1.0 (smoke push)',
    })
    .onConflictDoUpdate({
      target: pushSubscriptionInTelerady.endpoint,
      set: {
        userId,
        p256dh,
        auth,
        userAgent: 'telerady-seed/1.0 (smoke push)',
        revokedAt: null,
      },
    })
    .returning({
      id: pushSubscriptionInTelerady.id,
      createdAt: pushSubscriptionInTelerady.createdAt,
    });

  console.log('Push smoke subscription ensured.');
  console.log(`  email      : ${email}`);
  console.log(`  user_id    : ${userId}`);
  console.log(`  sub_id     : ${row.id}`);
  console.log(`  endpoint   : ${endpoint}`);
  console.log('');
  console.log('Trigger a push by going through the normal flow (assign a study,');
  console.log('mark urgent, etc.). PushService will attempt delivery, the bogus');
  console.log('endpoint will fail DNS, and you will see { failed: 1 } in the');
  console.log('audit row + push_notifications_total{result="failed"} metric tick.');

  process.exit(0);
}

main().catch((err) => {
  console.error('seed:push failed:', err);
  process.exit(1);
});
