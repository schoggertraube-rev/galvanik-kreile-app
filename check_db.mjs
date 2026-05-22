import postgres from 'postgres';
const connectionString = "postgresql://postgres:Kreiledatabase2026@db.syhaigjhsbpjmtnggqka.supabase.co:5432/postgres?sslmode=require";
const sql = postgres(connectionString);
async function check() {
  try {
    const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    console.log(res);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();
