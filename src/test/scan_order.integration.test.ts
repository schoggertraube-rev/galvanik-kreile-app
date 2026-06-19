import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { test, expect, vi } from "vitest";

// Mock authorization to bypass auth guards during testing
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      userId: "test-admin-id",
      tenantId: "galvanik-kreile",
      displayName: "Test Admin",
      role: "admin",
      permissions: ["perm_sys_diag"],
      active: true
    }
  })
}));

import { createOrderFromScan } from "@/app/actions/orders.actions";
import { db } from "@/db";
import { orders, customers } from "@/db/schema";
import { sql } from "drizzle-orm";

test("createOrderFromScan creates order successfully in the database", async () => {
  console.log("Starting Scan-to-Order Vitest integration test...");

  // 1. Ensure a customer exists to link the order to
  const customerName = "Testkunde Scan-E2E";
  let customerId = "";
  
  const existingCustomers = await db.select().from(customers).where(sql`${customers.name} = ${customerName}`);
  if (existingCustomers.length > 0) {
    customerId = existingCustomers[0].id;
  } else {
    // Create new customer for testing
    const { createCustomerDb } = await import("@/app/actions/customers.actions");
    const newCust = await createCustomerDb({
      company: customerName,
      firstName: "Test",
      lastName: "Scan-E2E",
      street: "Hauptstraße 5",
      houseNumber: "5",
      city: "Frankfurt",
      postalCode: "60311",
      country: "DE",
      type: "business",
      email: "testkunde@scan-e2e.de",
      phone: "0151999999"
    });
    if (newCust.ok) {
      customerId = newCust.data.id;
    } else {
      throw new Error("Failed to create test customer: " + JSON.stringify(newCust));
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

  expect(actionResult.ok).toBe(true);

  // 4. Count orders after the write
  const countAfterRes = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  const countAfter = countAfterRes[0].count;
  console.log("Orders count after:", countAfter);

  const diff = countAfter - countBefore;
  console.log(`Difference in orders table rows: ${diff}`);

  expect(diff).toBe(1);
  console.log("✅ Scan-to-Order integration test completed successfully!");
});
