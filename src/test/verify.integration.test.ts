import { expect, test, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));

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

test('Customer creation denies without a W3 command contract', async () => {

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

  await expect(createCustomerDb(payload)).resolves.toEqual({
    ok: false,
    error: "CONFLICT",
    message: "NOT_AVAILABLE: Kundenerstellung benötigt den W3-Command-Vertrag.",
  });
});
