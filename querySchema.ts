import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import * as fs from 'fs';

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing DATABASE_URL");
  const sql = postgres(connectionString);
  
  const sqlContent = fs.readFileSync('supabase/migrations/20260626000001_missing_customer_calendar_columns.sql', 'utf8');
  
  console.log("Applying migration...");
  await sql.unsafe(sqlContent);
  console.log("Migration applied successfully!");
  
  await sql.end();
}

run().catch(console.error);
