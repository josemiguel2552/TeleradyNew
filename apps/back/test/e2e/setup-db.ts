/**
 * Boots a single Postgres testcontainer for the whole e2e suite, applies
 * the canonical seed (apps/back/db-seed.sql) and exposes a Drizzle
 * client + a helper that runs each test inside its own SAVEPOINT so
 * tests stay isolated without paying the cost of a fresh container.
 */
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Client } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface E2EContext {
  container: StartedPostgreSqlContainer;
  client: Client;
  db: NodePgDatabase<Record<string, never>>;
  connectionString: string;
}

let cached: E2EContext | null = null;

export async function bootDatabase(): Promise<E2EContext> {
  if (cached) return cached;
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('telerady')
    .withUsername('telerady')
    .withPassword('telerady')
    .start();
  const connectionString = container.getConnectionUri();

  const client = new Client({ connectionString });
  await client.connect();
  const seed = readFileSync(join(__dirname, '..', '..', 'db-seed.sql'), 'utf8');
  await client.query(seed);

  const db = drizzle(client, { schema: undefined });
  cached = { container, client, db, connectionString };
  return cached;
}

export async function tearDown(): Promise<void> {
  if (!cached) return;
  await cached.client.end();
  await cached.container.stop();
  cached = null;
}

/**
 * Wipes the rows we touch in each test. Faster than a savepoint rewrite
 * because we keep the seeded catalogue (specialty, subspecialty, …).
 */
export async function resetTestRows(ctx: E2EContext): Promise<void> {
  await ctx.client.query(sql`
    DELETE FROM telerady.audit_log;
    DELETE FROM telerady.report;
    DELETE FROM telerady.report_study;
    DELETE FROM telerady.hospital_membership;
    DELETE FROM telerady.user_role_assignment;
    DELETE FROM telerady.refresh_token;
    DELETE FROM telerady.app_user;
    DELETE FROM telerady.hospital;
  `.queryChunks.join(''));
}
