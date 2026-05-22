import postgres from 'postgres';
import { config } from 'dotenv';
config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
console.log("Testing connection:", connectionString);

const sql = postgres(connectionString);
async function check() {
  try {
    const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    console.log("Success! Found tables:", res.length);
  } catch(e) {
    console.error("Connection Failed:", e);
  } finally {
    process.exit(0);
  }
}
check();
