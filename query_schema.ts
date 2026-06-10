import { db } from './src/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  const r2 = await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ausgangsrechnung';
  `);
  console.log("ausgangsrechnung:", r2);
}
main().catch(console.error).finally(() => process.exit(0));
