import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as baseSchema from './schema';
import * as buchhaltungSchema from './schema_buchhaltung';
import * as marketingSchema from './schema_marketing';

const schema = { ...baseSchema, ...buchhaltungSchema, ...marketingSchema };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const connectionString = process.env.DATABASE_URL;

// Fix for Next.js HMR connection pool exhaustion
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const client = globalForDb.conn ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.conn = client;

export const db = drizzle(client, { schema });
