import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { faker } from "@faker-js/faker";
import * as schema from "./schema";
import { createId } from "@paralleldrive/cuid2";

import { config } from "dotenv";
config({ path: ".env.local" });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || dbUrl.startsWith("file:")) {
  console.error("❌ FEHLER: Es wurde keine PostgreSQL DATABASE_URL gefunden (aktuell SQLite oder leer).");
  console.error("👉 Bitte in der .env Datei einen gültigen PostgreSQL Connection-String eintragen (z.B. von Supabase oder Neon), bevor du seedest.");
  process.exit(1);
}

const client = postgres(dbUrl, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  faker.seed(42);
  const tenantId = "hotel-kreile";

  console.log(`🌱 Starte Seed-Prozess für Tenant: ${tenantId}...`);

  // --- 1. USERS ---
  const users = [
    { id: createId(), email: "admin@kreile.de", fullName: "Admin User", role: "admin", tenantId },
    { id: createId(), email: "meister@kreile.de", fullName: "Meister User", role: "meister", tenantId },
    { id: createId(), email: "office@kreile.de", fullName: "Office User", role: "office", tenantId },
    { id: createId(), email: "werkstatt1@kreile.de", fullName: "Workshop 1", role: "workshop", tenantId },
    { id: createId(), email: "werkstatt2@kreile.de", fullName: "Workshop 2", role: "workshop", tenantId },
    { id: createId(), email: "quality@kreile.de", fullName: "Quality User", role: "quality", tenantId },
  ];
  await db.insert(schema.users).values(users);
  console.log("✅ 6 User erstellt.");

  // --- 2. CUSTOMERS ---
  const customers = [];
  for (let i = 0; i < 25; i++) {
    const type = i < 15 ? "private" : i < 20 ? "business" : "institution";
    customers.push({
      id: createId(),
      tenantId,
      customerNumber: `K-${1000 + i}`,
      name: type === "private" ? faker.person.fullName() : faker.company.name(),
      type,
      city: faker.location.city(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
    });
  }
  await db.insert(schema.customers).values(customers);
  console.log("✅ 25 Kunden erstellt.");

  // --- 3. INVENTORY ITEMS (12) ---
  const inventoryItems = [];
  for (let i = 0; i < 12; i++) {
    inventoryItems.push({
      id: createId(),
      tenantId,
      sku: `MAT-${100 + i}`,
      name: `Material ${faker.commerce.productMaterial()}`,
      category: i < 4 ? "chemical" : i < 8 ? "consumable" : "tooling",
      unit: ["kg", "l", "pcs"][i % 3],
      currentStock: faker.number.int({ min: 10, max: 100 }),
      minStock: 20,
    });
  }
  await db.insert(schema.inventoryItems).values(inventoryItems);
  console.log("✅ 12 Lagerartikel erstellt.");

  // --- 4. BATHS (4) ---
  const baths = [
    { id: createId(), tenantId, bathNumber: "B1", name: "Nickelbad 1", processType: "nickel", stationId: "galvanik" },
    { id: createId(), tenantId, bathNumber: "B2", name: "Chrombad 1", processType: "chrome", stationId: "galvanik" },
    { id: createId(), tenantId, bathNumber: "B3", name: "Entfettung 1", processType: "degreasing", stationId: "entmetallisierung" },
    { id: createId(), tenantId, bathNumber: "B4", name: "Entmetallisierung 1", processType: "stripping", stationId: "entmetallisierung" },
  ];
  await db.insert(schema.baths).values(baths);
  console.log("✅ 4 Bäder erstellt.");

  // --- 5. ORDERS (40) & ITEMS ---
  const orders = [];
  const items = [];
  const stations = ["wareneingang", "entmetallisierung", "schleiferei", "galvanik", "warenausgang"];
  
  for (let i = 0; i < 40; i++) {
    const isCritical = i < 8; // 8 critical
    const orderId = createId();
    const customer = customers[faker.number.int({ min: 0, max: 24 })];
    const currentStationId = stations[faker.number.int({ min: 0, max: 4 })];
    
    orders.push({
      id: orderId,
      tenantId,
      orderNumber: `A-${202600 + i}`,
      customerId: customer.id,
      title: `${faker.commerce.productAdjective()} Restauration`,
      currentStationId,
      status: "in_progress",
      priorityComputed: isCritical ? "critical" : "in_plan",
    });

    items.push({
      id: createId(),
      tenantId,
      itemNumber: `P-${orderId.substring(0, 5)}-1`,
      orderId,
      customerId: customer.id,
      name: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 5 }),
      currentStationId,
    });
  }
  await db.insert(schema.orders).values(orders);
  await db.insert(schema.items).values(items);
  console.log("✅ 40 Aufträge & Bauteile erstellt (davon 8 kritisch).");

  // --- 6. DEMO LOGS (Events, Movements, Measurements) ---
  const stockMovements = [];
  for (let i = 0; i < 60; i++) {
    stockMovements.push({
      id: createId(),
      tenantId,
      inventoryItemId: inventoryItems[faker.number.int({ min: 0, max: 11 })].id,
      movementType: i % 2 === 0 ? "stock_in" : "consumption",
      quantity: faker.number.int({ min: 1, max: 10 }),
      unit: "pcs",
      createdBy: users[faker.number.int({ min: 0, max: 5 })].id,
    });
  }
  await db.insert(schema.stockMovements).values(stockMovements);

  const bathMeasurements = [];
  for (let i = 0; i < 30; i++) {
    bathMeasurements.push({
      id: createId(),
      tenantId,
      bathId: baths[faker.number.int({ min: 0, max: 3 })].id,
      temperature: faker.number.int({ min: 40, max: 60 }),
      ph: faker.number.float({ min: 3, max: 9, fractionDigits: 1 }),
      statusAfterMeasurement: "stable",
    });
  }
  await db.insert(schema.bathMeasurements).values(bathMeasurements);

  const statusEvents = [];
  for (let i = 0; i < 80; i++) {
    statusEvents.push({
      id: createId(),
      tenantId,
      orderId: orders[faker.number.int({ min: 0, max: 39 })].id,
      eventType: "STATION_COMPLETED",
    });
  }
  await db.insert(schema.statusEvents).values(statusEvents);
  
  console.log("✅ Demo-Logs (60x Stock, 30x Badmessungen, 80x Events) erstellt.");

  console.log("🎉 Seeding abgeschlossen!");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seeding fehlgeschlagen:", e);
  process.exit(1);
});
