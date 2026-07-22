import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as baseSchema from './schema';
import * as buchhaltungSchema from './schema_buchhaltung';
import * as marketingSchema from './schema_marketing';
import * as erfassungSchema from './schema_erfassung';
import * as operatorSchema from './schema_operator';

const schema = { ...baseSchema, ...buchhaltungSchema, ...marketingSchema, ...erfassungSchema, ...operatorSchema };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const connectionString = process.env.DATABASE_URL;
const runtimeRole = process.env.DATABASE_RUNTIME_ROLE?.trim() || "service_role";
if (!/^[a-z_][a-z0-9_]{0,62}$/.test(runtimeRole)) {
  throw new Error("DATABASE_RUNTIME_ROLE is invalid");
}

// Fix for Next.js HMR connection pool exhaustion
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const client = globalForDb.conn ?? postgres(connectionString, {
  prepare: false,
  // Every pooled connection assumes the same least-privilege database role and
  // resolves PostgreSQL catalog objects before application-schema objects. The
  // capability gates additionally reject a privileged session login, so SET
  // ROLE NONE can recover only the deliberately unprivileged broker login.
  connection: {
    application_name: "kreile-workstattcockpit",
    options: `-c role=${runtimeRole} -c search_path=pg_catalog,public,pg_temp`,
  },
});
if (process.env.NODE_ENV !== "production") globalForDb.conn = client;

export const db = drizzle(client, { schema });
