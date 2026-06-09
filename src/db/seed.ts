import { db } from "./index";
import { 
  customers, 
  orders, 
  priceAgreements, 
  events, 
  complaints, 
  baeder, 
  inventoryItems, 
  appUsers 
} from "./schema";
import { 
  INITIAL_CUSTOMERS, 
  INITIAL_ORDERS, 
  INITIAL_COMPLAINTS, 
} from "../lib/mockData";

export async function seedDatabase({ safeMode = false } = {}) {
  console.log("🌱 Starte Datenbank-Seeding für V2...");

  try {
    // 1. Cleanup existing data (Cascade deletes handle relations if configured, but safe ordering is best)
    if (!safeMode) {
      console.log("🧹 Lösche alte Daten...");
      await db.delete(complaints);
      await db.delete(events);
      await db.delete(orders);
      await db.delete(priceAgreements);
      await db.delete(customers);
      await db.delete(baeder);
      await db.delete(inventoryItems);
      await db.delete(appUsers);
    } else {
      console.log("🛡️ Safe Mode aktiv: Überspringe Löschvorgang...");
    }

    // 2. Create appUsers
    console.log("👤 Lege Benutzer an...");
    await db.insert(appUsers).values([
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "schoggertraube@gmail.com",
        fullName: "Master Admin",
        role: "developer",
        active: true,
      },
      {
        id: "223e4567-e89b-12d3-a456-426614174001",
        email: "admin@kreile.de",
        fullName: "Max Kreile",
        role: "admin",
        pinHash: "1234",
        active: true,
      },
      {
        id: "323e4567-e89b-12d3-a456-426614174002",
        email: "werkstatt@kreile.de",
        fullName: "Christian Dieter",
        role: "werkstatt",
        pinHash: "1234",
        active: true,
      },
      {
        id: "423e4567-e89b-12d3-a456-426614174003",
        email: "buero@kreile.de",
        fullName: "Reiner Schmitt",
        role: "buero",
        pinHash: "1234",
        active: true,
      }
    ]);

    // 3. Insert Customers
    console.log(`🏢 Lege ${INITIAL_CUSTOMERS.length} Kunden an...`);
    for (const c of INITIAL_CUSTOMERS) {
      await db.insert(customers).values({
        id: c.id,
        name: c.name,
        type: c.type,
        city: c.city,
        address: c.address,
        phone: c.phone,
        email: c.email,
        prefComm: c.prefComm,
        risk: c.risk,
        riskNote: c.riskNote,
        notes: c.notes,
      });

      // Price Agreements for this customer
      if (c.priceAgreements && c.priceAgreements.length > 0) {
        for (const pa of c.priceAgreements) {
          await db.insert(priceAgreements).values({
            id: pa.id,
            customerId: c.id,
            scope: pa.scope,
            rate: pa.rate,
            date: new Date(pa.date),
          });
        }
      }
    }

    // 4. Insert Orders
    console.log(`📦 Lege ${INITIAL_ORDERS.length} Aufträge an...`);
    for (const o of INITIAL_ORDERS) {
      // Create a clean fallback for intakeDate to satisfy timestamp format
      const intakeDate = o.intakeDate ? new Date(o.intakeDate) : new Date();
      const dueDate = o.dueDate ? new Date(o.dueDate) : null;

      await db.insert(orders).values({
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId,
        title: o.task || "Unbekannter Auftrag",
        task: o.task,
        station: o.station,
        currentStationId: o.currentStationId,
        status: o.status || "in_progress",
        risk: o.risk || "green",
        parts: o.parts as unknown as Record<string, unknown>[],
        statusText: o.statusText,
        delayReason: o.delayReason,
        recommendedAction: o.recommendedAction,
        intakeDate,
        dueDate,
      });
    }

    // 6. Insert Complaints
    if (INITIAL_COMPLAINTS && INITIAL_COMPLAINTS.length > 0) {
      console.log(`⚠️ Lege ${INITIAL_COMPLAINTS.length} Reklamationen an...`);
      for (const c of INITIAL_COMPLAINTS) {
        await db.insert(complaints).values({
          id: c.id,
          orderId: c.orderId,
          customerId: c.customerId,
          reason: c.reason,
          status: c.status,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        });
      }
    }

    console.log("✅ Seeding erfolgreich abgeschlossen!");
    return { success: true };
  } catch (error) {
    console.error("❌ Fehler beim Seeding:", error);
    throw error;
  }
}

// Wenn die Datei direkt über tsx/node aufgerufen wird:
if (require.main === module || process.argv[1]?.includes('seed')) {
  seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}
