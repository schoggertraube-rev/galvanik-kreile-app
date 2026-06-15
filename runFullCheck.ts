import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

async function run() {
  const sql = postgres(process.env.DATABASE_URL!);
  console.log('=== CUSTOMERS (latest 5) ===');
  const customers = await sql`
    select id, customer_number, name, first_name, last_name, type as customer_type, created_at
    from customers
    order by created_at desc
    limit 5;
  `;
  console.log(JSON.stringify(customers, null, 2));

  console.log('=== ORDERS (latest 5) ===');
  const orders = await sql`
    select id, order_number, title, customer_id, created_at
    from orders
    order by created_at desc
    limit 5;
  `;
  console.log(JSON.stringify(orders, null, 2));

  console.log('=== ITEMS (latest 5) ===');
  const items = await sql`
    select id, order_id, name, material, created_at
    from items
    order by created_at desc
    limit 5;
  `;
  console.log(JSON.stringify(items, null, 2));

  console.log('=== EVENTS (latest 10) ===');
  const events = await sql`
    select *
    from events
    order by created_at desc
    limit 10;
  `;
  console.log(JSON.stringify(events, null, 2));

  await sql.end();
}
run().catch(console.error);
