import { test } from 'vitest';

const integrationDatabaseUrl = process.env.KREILE_INTEGRATION_DATABASE_URL;
const integrationTest = integrationDatabaseUrl ? test : test.skip;

integrationTest('transitionOrderProcess starts or cancels but cannot bypass atomic completion', async () => {
  process.env.DATABASE_URL = integrationDatabaseUrl;
  const [{ transitionOrderProcess }, { db }, { orders, customers }, { createId }] = await Promise.all([
    import('@/app/actions/orders.actions'),
    import('@/db'),
    import('@/db/schema'),
    import('@paralleldrive/cuid2'),
  ]);
  console.log("TEST: Prozessstart/-storno ohne Abschluss-Bypass");
  
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
    status: "ready"
  });

  let res = await transitionOrderProcess({ orderId: oid, action: "start", expectedStation: "wareneingang", clientRequestId: crypto.randomUUID() });
  if (!res.ok || res.data?.newStation !== "wareneingang" || res.data?.newStatus !== "in_progress") throw new Error("Start was not confirmed");

  const forbiddenCompletion = await transitionOrderProcess({ orderId: oid, action: "complete", expectedStation: "wareneingang", clientRequestId: crypto.randomUUID() });
  if (forbiddenCompletion.ok) throw new Error("Generic transition unexpectedly completed a station");

  res = await transitionOrderProcess({ orderId: oid, action: "cancel", expectedStation: "wareneingang", clientRequestId: crypto.randomUUID() });
  if (!res.ok || res.data?.newStatus !== "cancelled") throw new Error("Cancellation was not confirmed");

  console.log("PASS: generic completion bypass rejected");
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
