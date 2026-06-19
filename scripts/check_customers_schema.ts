import { db } from '@/db';
import { sql } from 'drizzle-orm';

(async () => {
  const result = await db.execute(sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' ORDER BY ordinal_position;`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})();
