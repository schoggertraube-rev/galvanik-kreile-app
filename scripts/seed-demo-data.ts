import { config } from "dotenv";
config({ path: ".env.local" }); // MUST be before importing db

import { db } from "../src/db";
import { customers, orders, items, events, baths, phoneNotes, complaints } from "../src/db/schema";
import { generateDemoData } from "../src/lib/demoDataGenerator";

async function runSeed() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--confirm");

  console.log("🚀 Starte Demo-Daten Seed (ID-Prefix: demo_)...");
  
  if (isDryRun) {
    console.log("⚠️ DRY-RUN MODUS AKTIV: Es werden keine Daten in die Datenbank geschrieben.");
    console.log("Zum echten Ausführen: npm run demo:seed -- --confirm\n");
  } else {
    console.log(`⚠️ ECHTER LAUF AKTIV\n`);
  }

  const data = generateDemoData();

  if (isDryRun) {
    console.log(`Würde folgende Daten anlegen:
- Kunden: ${data.customers.length}
- Aufträge: ${data.orders.length}
- Teile: ${data.items.length}
- Events: ${data.events.length}
- Reklamationen: ${data.complaints.length}
- Telefonnotizen: ${data.phoneNotes.length}`);
    console.log("✅ Dry-Run erfolgreich beendet (Keine Änderungen).");
    process.exit(0);
  }

  try {
    console.log(`🏢 Füge ${data.customers.length} Demo-Kunden ein...`);
    for (const c of data.customers) {
      await db.insert(customers).values(c).onConflictDoUpdate({ target: customers.id, set: c });
    }

    console.log(`📦 Füge ${data.orders.length} Demo-Aufträge ein...`);
    for (const o of data.orders) {
      await db.insert(orders).values(o).onConflictDoUpdate({ target: orders.id, set: o });
    }

    console.log(`⚙️ Füge ${data.items.length} Demo-Items ein...`);
    for (const i of data.items) {
      await db.insert(items).values(i).onConflictDoUpdate({ target: items.id, set: i });
    }

    console.log(`📝 Füge ${data.events.length} Demo-Events ein...`);
    for (const e of data.events) {
      await db.insert(events).values(e).onConflictDoUpdate({ target: events.id, set: e });
    }

    if (data.complaints.length > 0) {
      console.log(`⚠️ Füge ${data.complaints.length} Demo-Reklamationen ein...`);
      for (const c of data.complaints) {
        await db.insert(complaints).values(c).onConflictDoUpdate({ target: complaints.id, set: c });
      }
    }

    if (data.phoneNotes.length > 0) {
      console.log(`📞 Füge ${data.phoneNotes.length} Demo-Telefonnotizen ein...`);
      for (const pn of data.phoneNotes) {
        await db.insert(phoneNotes).values(pn).onConflictDoUpdate({ target: phoneNotes.id, set: pn });
      }
    }

    console.log("✅ Demo-Daten Seed erfolgreich in die Datenbank geschrieben!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fehler beim Seed:", err);
    process.exit(1);
  }
}

runSeed();
