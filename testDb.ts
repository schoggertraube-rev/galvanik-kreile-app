import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getOrdersDb } from "./src/app/actions/orders.actions";

async function run() {
  console.log("Testing DB connection...");
  const res = await getOrdersDb();
  console.log("Result:", res);
}

run();
