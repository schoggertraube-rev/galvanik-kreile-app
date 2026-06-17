import { test } from 'vitest';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for integration tests");
}
import { transitionOrderProcess } from '@/app/actions/orders.actions';
import { createCustomerDb } from '@/app/actions/customers.actions';
import { db } from '@/db';
import { orders, customers } from '@/db/schema';
import { createId } from '@paralleldrive/cuid2';

test('transitionOrderProcess moves order through chain correctly', async () => {
  console.log("TEST: Prozessschritt klicken -> DB-Zustand korrekt");
  
  // create dummy order
  const cid = createId();
  await db.insert(customers).values({ id: cid, name: "Testkunde", type: "business", street: "Teststr 1" });
  
  const oid = createId();
  await db.insert(orders).values({
    id: oid,
    orderNumber: "A-2026-99999",
    customerId: cid,
    title: "Test Order",
    currentStationId: "wareneingang",
    status: "in_progress"
  });

  // Wareneingang -> Entmetallisierung
  let res = await transitionOrderProcess({ orderId: oid, action: "complete" });
  if (!res.ok || res.data?.newStation !== "entmetallisierung") throw new Error("Failed step 1");

  // Entmetallisierung -> Schleiferei
  res = await transitionOrderProcess({ orderId: oid, action: "complete" });
  if (!res.ok || res.data?.newStation !== "schleiferei") throw new Error("Failed step 2");

  // Schleiferei -> Galvanik
  res = await transitionOrderProcess({ orderId: oid, action: "complete" });
  if (!res.ok || res.data?.newStation !== "galvanik") throw new Error("Failed step 3");

  // Galvanik -> QS
  res = await transitionOrderProcess({ orderId: oid, action: "complete" });
  if (!res.ok || res.data?.newStation !== "qualitaetssicherung" || res.data?.newStatus !== "QS/Fertigprüfung") throw new Error("Failed step 4");
  
  // QS -> Warenausgang
  res = await transitionOrderProcess({ orderId: oid, action: "complete" });
  if (!res.ok || res.data?.newStation !== "warenausgang" || res.data?.newStatus !== "Bereit für Versand") throw new Error("Failed step 5");

  // Warenausgang -> Abgeschlossen
  res = await transitionOrderProcess({ orderId: oid, action: "complete" });
  if (!res.ok || res.data?.newStatus !== "abgeschlossen") throw new Error("Failed step 6");

  console.log("PASS: transitionOrderProcess verified");
});

test('Customer creation works with full payload', async () => {
  console.log("TEST: ausgefüllter Kunde wird validiert und gespeichert");

  const payload = {
    firstName: "Max",
    lastName: "Mustermann",
    email: "max@test.de",
    phone: "01511234567",
    street: "Musterstraße",
    houseNumber: "1",
    postalCode: "12345",
    city: "Musterstadt",
    country: "DE",
    type: "privat"
  };

  const result = await createCustomerDb(payload);
  if (!result.ok) {
    throw new Error("Validation failed: " + JSON.stringify(result));
  }
  
  console.log("PASS: Customer creation verified");
});
