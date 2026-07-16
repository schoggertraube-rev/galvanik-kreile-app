import { test } from 'vitest';

const integrationDatabaseUrl = process.env.KREILE_INTEGRATION_DATABASE_URL;
const integrationTest = integrationDatabaseUrl ? test : test.skip;

integrationTest('transitionOrderProcess moves order through chain correctly', async () => {
  process.env.DATABASE_URL = integrationDatabaseUrl;
  const [{ transitionOrderProcess }, { db }, { orders, customers }, { createId }] = await Promise.all([
    import('@/app/actions/orders.actions'),
    import('@/db'),
    import('@/db/schema'),
    import('@paralleldrive/cuid2'),
  ]);
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
  if (!res.ok || res.data?.newStation !== "qualitaetssicherung" || res.data?.newStatus !== "ready") throw new Error("Failed step 4");
  
  // QS -> Warenausgang
  res = await transitionOrderProcess({ orderId: oid, action: "complete" });
  if (!res.ok || res.data?.newStation !== "warenausgang" || res.data?.newStatus !== "ready") throw new Error("Failed step 5");

  // Warenausgang -> Abgeschlossen
  res = await transitionOrderProcess({ orderId: oid, action: "complete" });
  if (!res.ok || res.data?.newStatus !== "shipped") throw new Error("Failed step 6");

  console.log("PASS: transitionOrderProcess verified");
});

integrationTest('Customer creation works with full payload', async () => {
  process.env.DATABASE_URL = integrationDatabaseUrl;
  const { createCustomerDb } = await import('@/app/actions/customers.actions');
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
