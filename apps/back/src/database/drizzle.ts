import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgTransaction } from 'drizzle-orm/pg-core';

dotenv.config();
const db = drizzle(process.env.DATABASE_URL!);

type DB = typeof db;
type DBTransaction =  PgTransaction<any, any, any>;
export type DBOrTx = DB | DBTransaction;
export type { DBTransaction }; 
export{ db };