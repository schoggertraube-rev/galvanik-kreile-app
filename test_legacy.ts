import { db } from './src/db/index';
import { orders } from './src/db/schema';
import { sql, inArray, like, or } from 'drizzle-orm';
async function run() {
  try {
    const checkNumbers = ['A-207018', 'A-202650', 'A-204405'];
    const res = await db.select({
      id: orders.id,
      order_number: orders.orderNumber,
      source: orders.source,
      created_at: orders.createdAt,
    }).from(orders).where(
      or(
        inArray(orders.orderNumber, checkNumbers),
        like(orders.orderNumber, 'A-SEED-%'),
        like(orders.orderNumber, '%TEST%')
      )
    ).orderBy(orders.createdAt);
    
    console.log(JSON.stringify(res, null, 2));
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
