import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { config } from "dotenv";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.trim()) {
  throw new Error("DATABASE_URL is required");
}

let databaseUrl;
try {
  databaseUrl = new URL(connectionString);
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
}
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
}

console.log(`Connecting to PostgreSQL host ${databaseUrl.hostname}`);

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  try {
    console.log("Starte Migration...");
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("Migration erfolgreich.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("Migration fehlgeschlagen:", error);
  process.exitCode = 1;
});
