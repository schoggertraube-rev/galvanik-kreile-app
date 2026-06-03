import { config } from "dotenv";
config({ path: ".env.local" }); // MUST be before importing db

import { db } from "../src/db";
import { customers, orders, items, events, baths, phoneNotes } from "../src/db/schema";
import { like, eq, sql } from "drizzle-orm";

const DEMO_BATCH_ID = "demo-livegang-2026-06-03";

async function runCleanup() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--confirm");

  console.log(`🧹 Starte Cleanup der Demo-Daten (Batch: ${DEMO_BATCH_ID})...`);

  if (isDryRun) {
    console.log("⚠️ DRY-RUN MODUS AKTIV: Es werden keine Daten aus der Datenbank gelöscht.");
    console.log("Zum echten Löschen: npm run demo:cleanup -- --confirm\n");
  } else {
    console.log(`⚠️ ECHTER LÖSCH-LAUF AKTIV\n`);
  }

  try {
    // Vor dem Löschen zählen (Counts)
    const pnCount = await db.select({ count: sql<number>`cast(count(${phoneNotes.id}) as int)` }).from(phoneNotes).where(eq(phoneNotes.tenantId, "demo-galvanik-kreile"));
    const evtCount = await db.select({ count: sql<number>`cast(count(${events.id}) as int)` }).from(events).where(like(events.id, "DEMO-EVT-%"));
    const itmCount = await db.select({ count: sql<number>`cast(count(${items.id}) as int)` }).from(items).where(like(items.id, "DEMO-ITM-%"));
    const ordCount = await db.select({ count: sql<number>`cast(count(${orders.id}) as int)` }).from(orders).where(like(orders.id, "DEMO-ORD-%"));
    const cusCount = await db.select({ count: sql<number>`cast(count(${customers.id}) as int)` }).from(customers).where(like(customers.id, "DEMO-CUST-%"));
    const bthCount = await db.select({ count: sql<number>`cast(count(${baths.id}) as int)` }).from(baths).where(like(baths.id, "DEMO-BATH-%"));

    console.log(`Gefundene Datensätze zum Löschen:
- Phone Notes: ${pnCount[0].count}
- Events:      ${evtCount[0].count}
- Items:       ${itmCount[0].count}
- Orders:      ${ordCount[0].count}
- Customers:   ${cusCount[0].count}
- Baths:       ${bthCount[0].count}
`);

    if (isDryRun) {
      console.log("✅ Dry-Run erfolgreich beendet (Keine Löschungen).");
      process.exit(0);
    }

    // 1. Phone Notes löschen (über tenantId)
    console.log("Lösche Demo-Telefonnotizen...");
    await db.delete(phoneNotes).where(eq(phoneNotes.tenantId, "demo-galvanik-kreile"));

    // 2. Events löschen
    console.log("Lösche Demo-Events...");
    await db.delete(events).where(like(events.id, "DEMO-EVT-%"));

    // 3. Items löschen
    console.log("Lösche Demo-Teile...");
    await db.delete(items).where(like(items.id, "DEMO-ITM-%"));

    // 4. Orders löschen
    console.log("Lösche Demo-Aufträge...");
    await db.delete(orders).where(like(orders.id, "DEMO-ORD-%"));

    // 5. Customers löschen
    console.log("Lösche Demo-Kunden...");
    await db.delete(customers).where(like(customers.id, "DEMO-CUST-%"));

    // 6. Bäder löschen
    console.log("Lösche Demo-Bäder...");
    await db.delete(baths).where(like(baths.id, "DEMO-BATH-%"));

    console.log("✅ Cleanup erfolgreich beendet!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fehler beim Cleanup:", err);
    process.exit(1);
  }
}

runCleanup();
