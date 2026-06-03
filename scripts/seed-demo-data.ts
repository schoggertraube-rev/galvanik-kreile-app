import { config } from "dotenv";
config({ path: ".env.local" }); // MUST be before importing db

import { db } from "../src/db";
import { customers, orders, items, events, baths, phoneNotes } from "../src/db/schema";
import { sql } from "drizzle-orm";

const DEMO_BATCH_ID = "demo-livegang-2026-06-03";

async function runSeed() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--confirm");

  console.log("🚀 Starte Demo-Daten Seed...");
  
  if (isDryRun) {
    console.log("⚠️ DRY-RUN MODUS AKTIV: Es werden keine Daten in die Datenbank geschrieben.");
    console.log("Zum echten Ausführen: npm run demo:seed -- --confirm\n");
  } else {
    console.log(`⚠️ ECHTER LAUF AKTIV (Batch: ${DEMO_BATCH_ID})\n`);
  }

  // 1. Kunden
  console.log("Erstelle Demo-Kunden (8)...");
  const demoCustomers = [
    { id: "DEMO-CUST-1", name: "Museum Lenzburg", type: "institution", city: "Lenzburg", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-CUST-2", name: "Atelier Schmid", type: "business", city: "Zürich", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-CUST-3", name: "Schreinerei Brunner", type: "business", city: "Bern", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-CUST-4", name: "Privatkunde Müller", type: "privat", city: "Basel", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-CUST-5", name: "Antik Galerie Main", type: "business", city: "Frankfurt", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-CUST-6", name: "Kirche St. Martin", type: "institution", city: "Kassel", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-CUST-7", name: "Oldtimerfreunde Wetterau", type: "business", city: "Friedberg", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-CUST-8", name: "Restaurierung Keller", type: "business", city: "Mainz", notes: `Batch: ${DEMO_BATCH_ID}` },
  ];

  if (!isDryRun) {
    for (const c of demoCustomers) {
      await db.insert(customers).values(c).onConflictDoUpdate({ target: customers.id, set: c });
    }
  }

  // 2. Aufträge
  console.log("Erstelle Demo-Aufträge (8)...");
  const demoOrders = [
    { id: "DEMO-ORD-1", orderNumber: "A-DEMO-001", customerId: "DEMO-CUST-1", title: "Jugendstilleuchter brünieren", status: "in_progress", station: "galvanik", currentStationId: "galvanik", statusText: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-ORD-2", orderNumber: "A-DEMO-002", customerId: "DEMO-CUST-2", title: "Türgriffe polieren und verchromen", status: "in_progress", station: "wareneingang", currentStationId: "wareneingang", statusText: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-ORD-3", orderNumber: "A-DEMO-003", customerId: "DEMO-CUST-7", title: "Stoßstangen vernickeln", status: "in_progress", station: "galvanik", currentStationId: "galvanik", statusText: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-ORD-4", orderNumber: "A-DEMO-004", customerId: "DEMO-CUST-4", title: "Motorradteile BMW R75 verchromen", status: "completed", station: "warenausgang", currentStationId: "warenausgang", statusText: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-ORD-5", orderNumber: "A-DEMO-005", customerId: "DEMO-CUST-8", title: "Besteckteile versilbern", status: "in_progress", station: "galvanik", currentStationId: "galvanik", statusText: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-ORD-6", orderNumber: "A-DEMO-006", customerId: "DEMO-CUST-3", title: "Möbelbeschläge vergolden", status: "in_progress", station: "wareneingang", currentStationId: "wareneingang", statusText: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-ORD-7", orderNumber: "A-DEMO-007", customerId: "DEMO-CUST-5", title: "Zinkteile prüfen und beschichten", status: "in_progress", station: "galvanik", currentStationId: "galvanik", statusText: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-ORD-8", orderNumber: "A-DEMO-008", customerId: "DEMO-CUST-6", title: "Kelch reinigen", status: "completed", station: "warenausgang", currentStationId: "warenausgang", statusText: `Batch: ${DEMO_BATCH_ID}` },
  ];

  if (!isDryRun) {
    for (const o of demoOrders) {
      await db.insert(orders).values(o).onConflictDoUpdate({ target: orders.id, set: o });
    }
  }

  // 3. Teile (Items)
  console.log("Erstelle Demo-Teile (5)...");
  const demoItems = [
    { id: "DEMO-ITM-1", orderId: "DEMO-ORD-1", customerId: "DEMO-CUST-1", name: "Leuchterfuß", quantity: 1, material: "Messing", surfaceRequested: "Brüniert" },
    { id: "DEMO-ITM-2", orderId: "DEMO-ORD-2", customerId: "DEMO-CUST-2", name: "Türgriff klassisch", quantity: 4, material: "Stahl", surfaceRequested: "Verchromt" },
    { id: "DEMO-ITM-3", orderId: "DEMO-ORD-3", customerId: "DEMO-CUST-7", name: "Stoßstange vorne", quantity: 1, material: "Stahl", surfaceRequested: "Vernickelt" },
    { id: "DEMO-ITM-4", orderId: "DEMO-ORD-4", customerId: "DEMO-CUST-4", name: "Tankdeckel", quantity: 1, material: "Stahl", surfaceRequested: "Verchromt" },
    { id: "DEMO-ITM-5", orderId: "DEMO-ORD-5", customerId: "DEMO-CUST-8", name: "Gabeln", quantity: 12, material: "Alpaka", surfaceRequested: "Versilbert" },
  ];

  if (!isDryRun) {
    for (const i of demoItems) {
      await db.insert(items).values(i).onConflictDoUpdate({ target: items.id, set: i });
    }
  }

  // 4. Events
  console.log("Erstelle Demo-Events (5)...");
  const demoEvents = [
    { id: "DEMO-EVT-1", orderId: "DEMO-ORD-1", eventType: "ORDER_CREATED", description: "Auftrag angelegt", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-EVT-2", orderId: "DEMO-ORD-1", eventType: "STATION_STARTED", description: "In Galvanik gestartet", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-EVT-3", orderId: "DEMO-ORD-4", eventType: "ORDER_CREATED", description: "Auftrag angelegt", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-EVT-4", orderId: "DEMO-ORD-4", eventType: "STATION_COMPLETED", description: "Galvanik abgeschlossen", notes: `Batch: ${DEMO_BATCH_ID}` },
    { id: "DEMO-EVT-5", orderId: "DEMO-ORD-4", eventType: "READY_FOR_SHIPPING", description: "Bereit für Warenausgang", notes: `Batch: ${DEMO_BATCH_ID}` },
  ];

  if (!isDryRun) {
    for (const e of demoEvents) {
      await db.insert(events).values(e).onConflictDoUpdate({ target: events.id, set: e });
    }
  }

  // 5. Phone Notes
  console.log("Erstelle Demo-Telefonnotizen (3)...");
  const demoPhoneNotes = [
    { tenantId: "demo-galvanik-kreile", customerId: "DEMO-CUST-1", orderId: "DEMO-ORD-1", rawText: "Wann ist der Leuchter fertig?", category: "Bearbeitungsstand", extractionJson: { batch: DEMO_BATCH_ID, isDemo: true } },
    { tenantId: "demo-galvanik-kreile", customerId: "DEMO-CUST-4", orderId: "DEMO-ORD-4", rawText: "Ich hole die Motorradteile morgen ab.", category: "Abholung", extractionJson: { batch: DEMO_BATCH_ID, isDemo: true } },
    { tenantId: "demo-galvanik-kreile", customerId: "DEMO-CUST-7", orderId: "DEMO-ORD-3", rawText: "Bitte bei der Stoßstange besonders auf die Ecken achten.", category: "Rückfrage Material/Oberfläche", extractionJson: { batch: DEMO_BATCH_ID, isDemo: true } },
  ];

  if (!isDryRun) {
    await db.delete(phoneNotes).where(sql`${phoneNotes.tenantId} = 'demo-galvanik-kreile'`);
    for (const pn of demoPhoneNotes) {
      await db.insert(phoneNotes).values(pn as typeof phoneNotes.$inferInsert);
    }
  }

  // 6. Bäder
  console.log("Erstelle Demo-Bäder (2)...");
  const demoBaths = [
    { id: "DEMO-BATH-1", name: "Glanznickel Bad 1 (DEMO)", status: "stable", temperatureMax: 60, temperatureMin: 55, phMax: 4, phMin: 3 },
    { id: "DEMO-BATH-2", name: "Chrom Bad (DEMO)", status: "warning", temperatureMax: 40, temperatureMin: 35, phMax: 2, phMin: 1 },
  ];
  if (!isDryRun) {
    for (const b of demoBaths) {
      await db.insert(baths).values(b).onConflictDoUpdate({ target: baths.id, set: b });
    }
  }

  if (isDryRun) {
    console.log("✅ Dry-Run erfolgreich beendet (Keine Änderungen).");
  } else {
    console.log("✅ Demo-Daten Seed erfolgreich in die Datenbank geschrieben!");
  }
  process.exit(0);
}

runSeed().catch(err => {
  console.error("❌ Fehler beim Seed:", err);
  process.exit(1);
});
