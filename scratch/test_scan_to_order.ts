import { createOrderFromScan } from "../src/app/actions/orders.actions";
import { db } from "../src/db";
import { orders, customers } from "../src/db/schema";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  console.log("Starting Scan-to-Order E2E DB write test...");

  // 1. Ensure a customer exists to link the order to
  const customerName = "Testkunde Scan-E2E";
  let customerId = "";
  
  const existingCustomers = await db.select().from(customers).where(sql`${customers.name} = ${customerName}`);
  if (existingCustomers.length > 0) {
    customerId = existingCustomers[0].id;
    console.log("Using existing customer:", customerId);
  } else {
    // Create new customer for testing
    const { createCustomerDb } = await import("../src/app/actions/customers.actions");
    const newCust = await createCustomerDb({
      company: customerName,
      firstName: "Test",
      lastName: "Scan-E2E",
      street: "Hauptstraße 5",
      houseNumber: "5",
      city: "Frankfurt",
      postalCode: "60311",
      country: "Deutschland",
      type: "business"
    });
    if (newCust.ok) {
      customerId = newCust.data.id;
      console.log("Created test customer:", customerId);
    } else {
      console.error("Failed to create test customer:", newCust);
      process.exit(1);
    }
  }

  // 2. Count orders before the write
  const countBeforeRes = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  const countBefore = countBeforeRes[0].count;
  console.log("Orders count before:", countBefore);

  // 3. Trigger Server Action createOrderFromScan
  const actionResult = await createOrderFromScan({
    customerId,
    title: "Auftrag per Scan Test E2E",
    parts: [
      { name: "Galvanisiertes Blech", quantity: 12, surfaceRequested: "Verzinkt", material: "Stahl" }
    ]
  });

  console.log("createOrderFromScan API result:", actionResult);

  if (!actionResult.ok) {
    console.error("Server Action failed:", actionResult);
    process.exit(1);
  }

  // 4. Count orders after the write
  const countAfterRes = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  const countAfter = countAfterRes[0].count;
  console.log("Orders count after:", countAfter);

  const diff = countAfter - countBefore;
  console.log(`Difference in orders table rows: ${diff}`);

  if (diff === 1) {
    console.log("✅ Success! Exactly 1 new order row has been added.");
    process.exit(0);
  } else {
    console.error(`❌ Mismatch! Difference is ${diff}, expected 1.`);
    process.exit(1);
  }
}

run().catch(console.error);
