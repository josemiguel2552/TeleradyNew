/**
 * Boots a single Postgres testcontainer for the whole e2e suite, applies
 * the canonical seed (`apps/back/db-seed.sql`) plus the RLS migration
 * (`infra/migrations/001-enable-rls.sql`), and exposes:
 *
 *   - `migratorClient` (BYPASSRLS) for arrange-phase seeding.
 *   - `appClient` factory that returns a pooled connection authenticated
 *     as `telerady_app`, ready for tests that want to exercise the
 *     production code path (RLS forced, GUC-driven scope).
 *
 * The suite runs with `maxWorkers: 1` so a single container is enough.
 */
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client, ClientConfig } from 'pg';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface E2EContext {
  container: StartedPostgreSqlContainer;
  /** Superuser client — used by the suite itself for arrange/teardown. */
  migratorClient: Client;
  /** Drizzle bound to the superuser; convenience for setup queries. */
  db: NodePgDatabase;
  migratorConnectionString: string;
  appConnectionString: string;
  /** Connect a fresh client as telerady_app (RLS-effective). */
  connectAsApp: () => Promise<Client>;
}

const APP_PASSWORD = 'rls-test-app-password';

let cached: E2EContext | null = null;

export async function bootDatabase(): Promise<E2EContext> {
  if (cached) return cached;

  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('telerady')
    .withUsername('telerady')
    .withPassword('telerady')
    .start();

  const migratorConnectionString = container.getConnectionUri();
  const migratorClient = new Client({ connectionString: migratorConnectionString });
  await migratorClient.connect();

  const seedPath = join(__dirname, '..', '..', 'db-seed.sql');
  const rlsPath = join(__dirname, '..', '..', '..', '..', 'infra', 'migrations', '001-enable-rls.sql');
  await migratorClient.query(readFileSync(seedPath, 'utf8'));
  await migratorClient.query(readFileSync(rlsPath, 'utf8'));
  await migratorClient.query(`ALTER ROLE telerady_app WITH PASSWORD '${APP_PASSWORD}'`);

  const appConnectionString = buildAppConnectionString(container, APP_PASSWORD);
  const db = drizzle(migratorClient);

  const connectAsApp = async (): Promise<Client> => {
    const client = new Client({ connectionString: appConnectionString });
    await client.connect();
    return client;
  };

  cached = {
    container,
    migratorClient,
    db,
    migratorConnectionString,
    appConnectionString,
    connectAsApp,
  };
  return cached;
}

export async function tearDown(): Promise<void> {
  if (!cached) return;
  await cached.migratorClient.end();
  await cached.container.stop();
  cached = null;
}

/**
 * Wipes the rows the suite touches. Keeps the seeded catalogue tables
 * (specialty, subspecialty, report_states, …) so each test starts with
 * the same baseline without paying the cost of a fresh container.
 */
export async function resetTestRows(ctx: E2EContext): Promise<void> {
  // Issued via the migrator so RLS doesn't get in the way.
  await ctx.migratorClient.query(`
    DELETE FROM telerady.audit_log;
    DELETE FROM telerady.report;
    DELETE FROM telerady.report_study;
    DELETE FROM telerady.mwl_entry;
    DELETE FROM telerady.hl7_message;
    DELETE FROM telerady.hospital_membership;
    DELETE FROM telerady.user_role_assignment;
    DELETE FROM telerady.refresh_token;
    DELETE FROM telerady.app_user;
    DELETE FROM telerady.hospital;
  `);
}

/**
 * The testcontainers helper only exposes the superuser URL. We rebuild
 * the connection string flipping the user to `telerady_app` so the test
 * actually exercises RLS.
 */
function buildAppConnectionString(
  container: StartedPostgreSqlContainer,
  password: string,
): string {
  const cfg: ClientConfig = {
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: 'telerady_app',
    password,
  };
  return `postgresql://${cfg.user}:${cfg.password}@${cfg.host}:${cfg.port}/${cfg.database}`;
}
