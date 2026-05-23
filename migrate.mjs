import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { config } from 'dotenv';

config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
console.log("Connecting to:", connectionString.replace(/:[^:@]+@/, ':***@'));

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  try {
    console.log("Starte Migration...");
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log("✅ Migration erfolgreich!");
  } catch (error) {
    console.error("❌ Migration fehlgeschlagen:", error);
  } finally {
    process.exit(0);
  }
}

main();
