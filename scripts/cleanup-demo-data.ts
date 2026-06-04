import { config } from "dotenv";
config({ path: ".env.local" }); // MUST be before importing db

import { db } from "../src/db";
import { customers, orders, items, events, phoneNotes, complaints } from "../src/db/schema";
import { like, sql } from "drizzle-orm";

async function runCleanup() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--confirm");

  console.log(`🧹 Starte Cleanup der Demo-Daten (Pattern: demo_%)...`);

  if (isDryRun) {
    console.log("⚠️ DRY-RUN MODUS AKTIV: Es werden keine Daten aus der Datenbank gelöscht.");
    console.log("Zum echten Löschen: npm run demo:cleanup -- --confirm\n");
  } else {
    console.log(`⚠️ ECHTER LÖSCH-LAUF AKTIV\n`);
  }

  try {
    const pattern = "demo_%";

    // Vor dem Löschen zählen (Counts)
    const pnCount = await db.select({ count: sql<number>`cast(count(${phoneNotes.id}) as int)` }).from(phoneNotes).where(like(phoneNotes.customerId, pattern));
    const compCount = await db.select({ count: sql<number>`cast(count(${complaints.id}) as int)` }).from(complaints).where(like(complaints.id, pattern));
    const evtCount = await db.select({ count: sql<number>`cast(count(${events.id}) as int)` }).from(events).where(like(events.id, pattern));
    const itmCount = await db.select({ count: sql<number>`cast(count(${items.id}) as int)` }).from(items).where(like(items.id, pattern));
    const ordCount = await db.select({ count: sql<number>`cast(count(${orders.id}) as int)` }).from(orders).where(like(orders.id, pattern));
    const cusCount = await db.select({ count: sql<number>`cast(count(${customers.id}) as int)` }).from(customers).where(like(customers.id, pattern));

    console.log(`Gefundene Datensätze zum Löschen:
- Phone Notes: ${pnCount[0].count}
- Complaints:  ${compCount[0].count}
- Events:      ${evtCount[0].count}
- Items:       ${itmCount[0].count}
- Orders:      ${ordCount[0].count}
- Customers:   ${cusCount[0].count}
`);

    if (isDryRun) {
      console.log("✅ Dry-Run erfolgreich beendet (Keine Löschungen).");
      process.exit(0);
    }

    // Löschen in sicherer Reihenfolge (trotz Cascade)
    console.log("Lösche Demo-Telefonnotizen...");
    await db.delete(phoneNotes).where(like(phoneNotes.customerId, pattern));

    console.log("Lösche Demo-Reklamationen...");
    await db.delete(complaints).where(like(complaints.id, pattern));

    console.log("Lösche Demo-Events...");
    await db.delete(events).where(like(events.id, pattern));

    console.log("Lösche Demo-Teile...");
    await db.delete(items).where(like(items.id, pattern));

    console.log("Lösche Demo-Aufträge...");
    await db.delete(orders).where(like(orders.id, pattern));

    console.log("Lösche Demo-Kunden...");
    await db.delete(customers).where(like(customers.id, pattern));

    console.log("✅ Cleanup erfolgreich beendet!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fehler beim Cleanup:", err);
    process.exit(1);
  }
}

runCleanup();
