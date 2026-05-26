import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing in env");
}

console.log("Connecting directly to PostgreSQL...");
const sql = postgres(connectionString, { max: 1 });

async function main() {
  try {
    console.log("Safely running ALTER TABLE orders ADD COLUMN IF NOT EXISTS task text; ...");
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS task text;`;
    console.log("✅ Column 'task' successfully added or already existed!");
  } catch (error) {
    console.error("❌ SQL Query failed:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

main();
