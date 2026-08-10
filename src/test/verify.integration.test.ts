import { expect, test } from 'vitest';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for integration tests");
}
import { transitionOrderProcess } from '@/app/actions/orders.actions';
import { createCustomerDb } from '@/app/actions/customers.actions';

test('transitionOrderProcess denies start, complete, and targetStep without a database seed', async () => {
  const expected = {
    ok: false,
    error: "CONFLICT",
    message: "NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag.",
  };

  for (const params of [
    { orderId: "order-denied-start", action: "start" },
    { orderId: "order-denied-complete", action: "complete" },
    { orderId: "order-denied-target", targetStep: "galvanik" },
  ]) {
    expect(await transitionOrderProcess(params)).toEqual(expected);
  }
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
