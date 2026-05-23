import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { createId } from "@paralleldrive/cuid2";

import { config } from "dotenv";
config({ path: ".env.local" });

import { 
  INITIAL_CUSTOMERS, 
  INITIAL_ORDERS, 
  INITIAL_INVENTORY, 
  INITIAL_BATHS, 
  INITIAL_MOVEMENTS, 
  INITIAL_MEASUREMENTS 
} from "../lib/mockData";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || dbUrl.startsWith("file:")) {
  console.error("❌ FEHLER: Es wurde keine PostgreSQL DATABASE_URL gefunden.");
  process.exit(1);
}

const client = postgres(dbUrl, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  const tenantId = "hotel-kreile";

  console.log(`🌱 Starte idempontenten Seed-Prozess für Tenant: ${tenantId}...`);

  // --- 0. DELETE ALL (IDEMPOTENT) ---
  console.log("🧹 Lösche alte Daten...");
  await db.delete(schema.statusEvents);
  await db.delete(schema.bathMeasurements);
  await db.delete(schema.stockMovements);
  await db.delete(schema.items);
  await db.delete(schema.orders);
  await db.delete(schema.baths);
  await db.delete(schema.inventoryItems);
  await db.delete(schema.customers);
  await db.delete(schema.users);
  
  // --- 1. USERS ---
  const adminId = createId();
  const users = [
    { id: adminId, email: "admin@kreile.de", fullName: "Admin User", role: "admin", tenantId },
    { id: createId(), email: "meister@kreile.de", fullName: "Meister User", role: "meister", tenantId },
    { id: createId(), email: "office@kreile.de", fullName: "Office User", role: "office", tenantId },
    { id: createId(), email: "werkstatt1@kreile.de", fullName: "Workshop 1", role: "workshop", tenantId },
  ];
  await db.insert(schema.users).values(users);
  console.log("✅ Users erstellt.");

  // --- 2. CUSTOMERS ---
  const dbCustomers = INITIAL_CUSTOMERS.map(c => ({
    id: c.id,
    tenantId,
    customerNumber: `K-${c.id}`,
    name: c.name,
    type: c.type,
    city: c.city,
    email: c.email,
    phone: c.phone,
  }));
  await db.insert(schema.customers).values(dbCustomers);
  console.log(`✅ ${dbCustomers.length} Kunden erstellt.`);

  // --- 3. ORDERS & ITEMS ---
  const dbOrders = [];
  const dbItems = [];
  
  for (const o of INITIAL_ORDERS) {
    dbOrders.push({
      id: o.id,
      tenantId,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      title: o.task,
      currentStationId: o.station,
      status: o.status === "completed" ? "completed" : "in_progress",
      priorityComputed: (o.risk === "red" || o.risk === "orange") ? "critical" : "in_plan"
    });
    
    for (const p of o.parts) {
      dbItems.push({
        id: p.id,
        tenantId,
        itemNumber: `P-${p.id}`,
        orderId: o.id,
        customerId: o.customerId,
        name: p.name,
        quantity: 1,
        currentStationId: p.station
      });
    }
  }
  
  await db.insert(schema.orders).values(dbOrders);
  await db.insert(schema.items).values(dbItems);
  console.log(`✅ ${dbOrders.length} Aufträge & ${dbItems.length} Bauteile erstellt.`);

  // --- 4. INVENTORY ---
  const dbInventory = INITIAL_INVENTORY.map(inv => ({
    id: inv.id,
    tenantId,
    sku: `SKU-${inv.id}`,
    name: inv.name,
    category: "chemical",
    unit: inv.unit,
    currentStock: inv.currentStock,
    minStock: inv.minStock,
  }));
  await db.insert(schema.inventoryItems).values(dbInventory);
  console.log(`✅ ${dbInventory.length} Lagerartikel erstellt.`);

  // --- 5. BATHS ---
  const dbBaths = INITIAL_BATHS.map(b => ({
    id: b.id,
    tenantId,
    bathNumber: `B-${b.id}`,
    name: b.name,
    processType: b.processType,
    stationId: "galvanik"
  }));
  await db.insert(schema.baths).values(dbBaths);
  console.log(`✅ ${dbBaths.length} Beschichtung erstellt.`);

  // --- 6. MOVEMENTS & MEASUREMENTS ---
  const dbMovements = INITIAL_MOVEMENTS.map(m => ({
    id: m.id,
    tenantId,
    inventoryItemId: m.inventoryItemId,
    movementType: m.type === 'IN' ? 'stock_in' : 'consumption',
    quantity: m.amount,
    createdBy: adminId
  }));
  await db.insert(schema.stockMovements).values(dbMovements);
  
  const dbMeasurements = INITIAL_MEASUREMENTS.map(m => ({
    id: m.id,
    tenantId,
    bathId: m.bathId,
    temperature: Math.round(m.temperature),
    ph: m.phValue,
    statusAfterMeasurement: "stable"
  }));
  await db.insert(schema.bathMeasurements).values(dbMeasurements);
  console.log(`✅ ${dbMovements.length} Stock-Movements und ${dbMeasurements.length} Badmessungen erstellt.`);

  // --- 7. STATUS EVENTS ---
  const dbEvents = [];
  let eCount = 0;
  for (const o of INITIAL_ORDERS) {
    if(o.risk === "red" || o.risk === "orange") {
      dbEvents.push({
        id: `ev_${eCount++}`,
        tenantId,
        orderId: o.id,
        eventType: "STATION_COMPLETED",
        notes: o.delayReason || "Verzögerung gemeldet",
        workerId: adminId
      });
    }
  }
  await db.insert(schema.statusEvents).values(dbEvents);
  console.log(`✅ ${dbEvents.length} Status Events erstellt.`);

  console.log("🎉 Idempotenter Hybrid-Seed abgeschlossen!");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seeding fehlgeschlagen:", e);
  process.exit(1);
});
