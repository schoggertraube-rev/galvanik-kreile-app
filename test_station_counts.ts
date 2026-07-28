import { db } from './src/db/index';
import './src/db/schema';
import { sql } from 'drizzle-orm';
async function run() {
  console.log('Started');
  try {
    const counts = await db.execute(sql`select current_station_id, count(*) from orders group by current_station_id order by current_station_id`);
    console.log(JSON.stringify(counts, null, 2));
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
