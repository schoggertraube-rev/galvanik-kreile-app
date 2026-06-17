import { db } from '@/db';
import { sql } from 'drizzle-orm';

(async () => {
  try {
    // Enable RLS on customers (no-op if already enabled)
    await db.execute(sql`ALTER TABLE customers ENABLE ROW LEVEL SECURITY;`);
    // Create a policy that allows all SELECTs (for testing/debug)
    await db.execute(sql`CREATE POLICY allow_select_customers ON customers FOR SELECT USING (true);`);
    console.log('✅ RLS SELECT policy added');
  } catch (e) {
    console.error('Failed to add RLS policy', e);
  }
  process.exit(0);
})();
