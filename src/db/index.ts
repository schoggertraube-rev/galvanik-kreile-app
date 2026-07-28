import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as baseSchema from './schema';
import * as buchhaltungSchema from './schema_buchhaltung';
import * as marketingSchema from './schema_marketing';

const schema = { ...baseSchema, ...buchhaltungSchema, ...marketingSchema };

// Fix for Next.js HMR connection pool exhaustion
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

function createDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = globalForDb.conn ?? postgres(connectionString, { prepare: false });
  if (process.env.NODE_ENV !== "production") globalForDb.conn = client;

  return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;

function getDatabase(): Database {
  database ??= createDatabase();
  return database;
}

/** Use this for explicit configuration fallbacks; `db` itself is a lazy proxy. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Importing a repository must not open a connection or require a secret during
 * route discovery. The first real query resolves the database and preserves
 * the previous explicit DATABASE_URL failure when configuration is absent.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const value = Reflect.get(getDatabase(), property);
    return typeof value === "function" ? value.bind(getDatabase()) : value;
  },
});
