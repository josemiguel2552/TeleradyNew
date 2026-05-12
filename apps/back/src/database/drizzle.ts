import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';

// `process.env.DATABASE_URL` has been validated at boot by ConfigModule.
// We keep this as a single global instance for now to minimise the legacy
// blast radius. Sprint 1 will introduce a DI provider and wire repos against
// it via constructor injection.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. Did you copy .env.example to .env or run ConfigModule first?',
  );
}

const db = drizzle(url);

type DB = typeof db;
type DBTransaction = PgTransaction<any, any, any>;
export type DBOrTx = DB | DBTransaction;
export type { DBTransaction };
export { db };
