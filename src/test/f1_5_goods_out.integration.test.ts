// @vitest-environment node

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { PaymentMode } from "@/lib/server/paymentContract";

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.F1_5_EXPECTED_DATABASE_URL;

if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal F1_5_EXPECTED_DATABASE_URL");
}
const parsedUrl = new URL(DATABASE_URL);
if (
  parsedUrl.protocol !== "postgresql:"
  || parsedUrl.hostname !== "127.0.0.1"
  || !/^\d{4,5}$/.test(parsedUrl.port)
  || parsedUrl.pathname !== "/postgres"
  || parsedUrl.username !== "postgres"
) throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: expected the dedicated local F1.5 Postgres database");
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

// AUTH_ADAPTER_SYNTHETIC_NOT_ACCEPTANCE: only the cookie/session adapter is
// synthetic. All A -> B/B2 -> C domain writes and readbacks use production
// commands and the fresh local Supabase schema.
const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const TENANT = KREILE_TENANT_SLUG;
const FOREIGN_TENANT = "f15-c-foreign";
const USERS = {
  werkstatt: "61616161-6161-4161-8161-616161616101",
  meister: "61616161-6161-4161-8161-616161616102",
  admin: "61616161-6161-4161-8161-616161616103",
  readonly: "61616161-6161-4161-8161-616161616104",
  buero: "61616161-6161-4161-8161-616161616105",
} as const;
const CUSTOMER = "f15-c-customer";
const FOREIGN_CUSTOMER = "f15-c-foreign-customer";
const FOREIGN_ORDER = "f15-c-foreign-order";
const RATE = "61616161-6161-4161-8161-616161616110";

function setSession(userId: string, role: keyof typeof USERS) {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId,
      tenantId: TENANT,
      role,
      displayName: `F1.5 C Synthetic ${role}`,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

async function seedPrerequisites() {
  await sql.begin(async (transaction) => {
    for (const [role, userId] of Object.entries(USERS)) {
      await transaction`
        INSERT INTO public.app_users
          (id, tenant_id, email, full_name, role, active, created_at, updated_at)
        VALUES (
          ${userId}::uuid, ${TENANT}, ${`f15-c-${role}@local.invalid`},
          ${`F1.5 C Synthetic ${role}`}, ${role}, true, now(), now()
        ) ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role,
          active = true, updated_at = now()
      `;
    }
    await transaction`
      INSERT INTO public.company_settings (
        id, tenant_id, company_name, street, zip, city, country,
        iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
        invoice_payment_term_days
      ) VALUES (
        'f14-command-settings', ${TENANT}, 'F1.5 Synthetic Galvanik GmbH',
        'Testweg 1', '70173', 'Stuttgart', 'Deutschland',
        'DE02120300000000202051', 'BYLADEM1001', 'F1.5 Testbank',
        'DE-SYNTHETIC-TAX', 1900, 14
      ) ON CONFLICT (id) DO UPDATE SET
        invoice_vat_rate_basis_points = EXCLUDED.invoice_vat_rate_basis_points
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type,
        street, zip_code, city, country, created_at, updated_at
      ) VALUES (
        ${CUSTOMER}, ${TENANT}, 'F15-C-001', 'F1.5 C Synthetic Customer',
        'F1.5 C Synthetic Customer GmbH', 'business', 'Kundenweg 2',
        '70174', 'Stuttgart', 'Deutschland', now(), now()
      ) ON CONFLICT (id) DO NOTHING
    `;
    await transaction`
      INSERT INTO public.customers (id, tenant_id, customer_number, name, type, created_at, updated_at)
      VALUES (
        ${FOREIGN_CUSTOMER}, ${FOREIGN_TENANT}, 'F15-C-F',
        'F1.5 C Foreign Customer', 'business', now(), now()
      ) ON CONFLICT (id) DO NOTHING
    `;
    await transaction`
      INSERT INTO public.orders (
        id, tenant_id, order_number, customer_id, title, station,
        current_station, current_station_id, version, status, created_at
      ) VALUES (
        ${FOREIGN_ORDER}, ${FOREIGN_TENANT}, 'A-F15-C-F', ${FOREIGN_CUSTOMER},
        'F1.5 C Foreign Order', 'fertig', 'fertig', 'fertig', 3, 'fertig', now()
      ) ON CONFLICT (id) DO NOTHING
    `;
    await transaction`
      INSERT INTO private.extra_work_hourly_rates
        (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
      VALUES (${RATE}::uuid, ${TENANT}, 12000, 1900, ${USERS.admin}::uuid, now())
      ON CONFLICT (tenant_id, version) DO NOTHING
    `;
  });
}

type ReadyOrder = {
  orderId: string;
  invoiceId: string;
  version: number;
  grossAmountCents: number;
};

async function createReadyOrder(label: string, paymentMode: PaymentMode): Promise<ReadyOrder> {
  setSession(USERS.admin, "admin");
  const { createOrderIntake } = await import("@/lib/server/commands/orderIntakeCommand");
  const intake = await createOrderIntake({
    clientEventId: randomUUID(),
    customer: { mode: "EXISTING", customerId: CUSTOMER },
    dueDate: "2026-09-30",
    note: `F1.5 C canonical ${label}`,
    items: [{
      name: `F1.5 C ${label}`,
      quantity: 1,
      material: "Stahl",
      surfaceRequested: "Galvanik",
    }],
  });
  expect(intake.code).toBe("OK");
  if (intake.code !== "OK") throw new Error(`F1_5_C_INTAKE_FAILED:${intake.code}`);
  const orderId = intake.receipt.orderId;
  const itemId = intake.receipt.items[0]?.id;
  if (!itemId) throw new Error("F1_5_C_ITEM_MISSING");

  if (paymentMode !== "vorkasse") {
    setSession(USERS.admin, "admin");
    const { setPaymentMode } = await import("@/lib/server/commands/setPaymentModeCommand");
    const modeResult = await setPaymentMode({
      orderId,
      paymentMode,
      expectedVersion: 0,
      clientEventId: randomUUID(),
    });
    expect(modeResult.code).toBe("OK");
  }

  setSession(USERS.admin, "admin");
  const { transitionWareneingangToGalvanik } = await import("@/lib/server/commands/orderStationCommand");
  const station = await transitionWareneingangToGalvanik({
    orderId,
    expectedVersion: intake.receipt.orderVersion,
    clientEventId: randomUUID(),
  });
  expect(station.code).toBe("OK");
  if (station.code !== "OK") throw new Error(`F1_5_C_STATION_FAILED:${station.code}`);

  // Isolated test preparation for the existing F1.3 price input. The actual
  // A/B/B2/C transitions remain production commands.
  await sql`
    UPDATE public.items SET preis_netto = 100.00
    WHERE id = ${itemId} AND order_id = ${orderId} AND tenant_id = ${TENANT}
  `;

  setSession(USERS.admin, "admin");
  const { freezeOrder } = await import("@/lib/server/commands/orderFreezeCommand");
  const frozen = await freezeOrder({
    orderId,
    freezeId: randomUUID(),
    expectedVersion: station.receipt.aggregateVersion,
    clientEventId: randomUUID(),
  });
  expect(frozen.code).toBe("OK");
  if (frozen.code !== "OK") throw new Error(`F1_5_C_FREEZE_FAILED:${frozen.code}`);

  setSession(USERS.admin, "admin");
  const { createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const issued = await createInvoice({
    orderId,
    expectedVersion: frozen.receipt.aggregateVersion,
    clientEventId: randomUUID(),
  });
  expect(issued.code).toBe("OK");
  if (issued.code !== "OK") throw new Error(`F1_5_C_INVOICE_FAILED:${issued.code}`);
  return {
    orderId,
    invoiceId: issued.receipt.invoiceId,
    version: frozen.receipt.aggregateVersion,
    grossAmountCents: issued.receipt.grossAmountCents,
  };
}

async function snapshot(orderId: string) {
  const [order] = await sql<{
    station: string;
    current_station: string;
    current_station_id: string;
    status: string;
    version: number;
    goods_out_events: number;
  }[]>`
    SELECT station, current_station, current_station_id, status, version,
      (SELECT count(*)::integer FROM public.events event
       WHERE event.tenant_id = orders.tenant_id
         AND event.order_id = orders.id
         AND event.event_type = 'ORDER_PICKED_UP_V1') AS goods_out_events
    FROM public.orders orders
    WHERE id = ${orderId}
  `;
  if (!order) throw new Error("F1_5_C_ORDER_READBACK_MISSING");
  return order;
}

async function payInFull(invoiceId: string, amount: number) {
  setSession(USERS.admin, "admin");
  const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");
  const result = await confirmPayment({
    invoiceId,
    amount,
    method: "ueberweisung",
    expectedVersion: 0,
    clientEventId: randomUUID(),
  });
  expect(result.code).toBe("OK");
  if (result.code !== "OK") throw new Error(`F1_5_C_PAYMENT_FAILED:${result.code}`);
  expect(result.receipt).toMatchObject({ paymentStatus: "bezahlt", openAmountCents: 0 });
  return result.receipt;
}

beforeAll(async () => {
  const [{ server_version_num: version }] = await sql<{ server_version_num: string }[]>`
    SELECT current_setting('server_version_num') AS server_version_num
  `;
  if (!version?.startsWith("17")) {
    throw new Error(`F1_5_LOCAL_DATABASE_REQUIRED: PostgreSQL 17 required, got ${version}`);
  }
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
});

describe("F1.5 C real goods-out command â€” AUTH_ADAPTER_SYNTHETIC_NOT_ACCEPTANCE", () => {
  it("proves Vorkasse, Abholung and Rechnung gates with tenant/role denial and exact receipts", async () => {
    await seedPrerequisites();
    const { recordGoodsOut } = await import("@/lib/server/commands/recordGoodsOutCommand");
    const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");

    const vorkasse = await createReadyOrder("Vorkasse Versand", "vorkasse");
    const pristineVorkasse = await snapshot(vorkasse.orderId);

    setSession(USERS.readonly, "readonly");
    await expect(recordGoodsOut({
      orderId: vorkasse.orderId,
      mode: "versand",
      expectedVersion: vorkasse.version,
      clientEventId: randomUUID(),
    })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(await snapshot(vorkasse.orderId)).toEqual(pristineVorkasse);

    setSession(USERS.werkstatt, "werkstatt");
    await expect(recordGoodsOut({
      orderId: FOREIGN_ORDER,
      mode: "abholung",
      expectedVersion: 3,
      clientEventId: randomUUID(),
    })).resolves.toMatchObject({ code: "NOT_FOUND" });
    expect(await snapshot(FOREIGN_ORDER)).toMatchObject({
      station: "fertig", version: 3, goods_out_events: 0,
    });

    const vorkasseInput = {
      orderId: vorkasse.orderId,
      mode: "versand" as const,
      expectedVersion: vorkasse.version,
      clientEventId: randomUUID(),
    };
    setSession(USERS.werkstatt, "werkstatt");
    await expect(recordGoodsOut(vorkasseInput)).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot(vorkasse.orderId)).toEqual(pristineVorkasse);

    setSession(USERS.buero, "buero");
    const partial = await confirmPayment({
      invoiceId: vorkasse.invoiceId,
      amount: 4_000,
      method: "ueberweisung",
      expectedVersion: 0,
      clientEventId: randomUUID(),
    });
    expect(partial.code).toBe("OK");
    if (partial.code !== "OK") throw new Error("F1_5_C_PARTIAL_PAYMENT_FAILED");
    setSession(USERS.werkstatt, "werkstatt");
    await expect(recordGoodsOut(vorkasseInput)).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot(vorkasse.orderId)).toEqual(pristineVorkasse);

    setSession(USERS.admin, "admin");
    const full = await confirmPayment({
      invoiceId: vorkasse.invoiceId,
      amount: vorkasse.grossAmountCents - 4_000,
      method: "ueberweisung",
      expectedVersion: 1,
      clientEventId: randomUUID(),
    });
    expect(full.code).toBe("OK");
    if (full.code !== "OK") throw new Error("F1_5_C_FULL_PAYMENT_FAILED");

    setSession(USERS.werkstatt, "werkstatt");
    const sent = await recordGoodsOut(vorkasseInput);
    expect(sent.code).toBe("OK");
    if (sent.code !== "OK") throw new Error(`F1_5_C_VORKASSE_GOODS_OUT_FAILED:${sent.code}`);
    expect(sent).toMatchObject({
      replayed: false,
      receipt: {
        orderId: vorkasse.orderId,
        orderVersion: vorkasse.version + 1,
        mode: "versand",
        paymentMode: "vorkasse",
        paymentStatus: "bezahlt",
        openAmountCents: 0,
        fromStation: "fertig",
        toStation: "abgeholt",
      },
    });
    expect(await snapshot(vorkasse.orderId)).toMatchObject({
      station: "abgeholt", current_station: "abgeholt", current_station_id: "abgeholt",
      status: "abgeholt", version: vorkasse.version + 1, goods_out_events: 1,
    });
    setSession(USERS.werkstatt, "werkstatt");
    await expect(recordGoodsOut(vorkasseInput)).resolves.toEqual({ ...sent, replayed: true });
    setSession(USERS.werkstatt, "werkstatt");
    await expect(recordGoodsOut({ ...vorkasseInput, mode: "abholung" })).resolves.toMatchObject({ code: "CONFLICT" });
    expect((await snapshot(vorkasse.orderId)).goods_out_events).toBe(1);

    const abholung = await createReadyOrder("Abholung", "abholung");
    const pristineAbholung = await snapshot(abholung.orderId);
    const abholungInput = {
      orderId: abholung.orderId,
      mode: "abholung" as const,
      expectedVersion: abholung.version,
      clientEventId: randomUUID(),
    };
    setSession(USERS.meister, "meister");
    await expect(recordGoodsOut(abholungInput)).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot(abholung.orderId)).toEqual(pristineAbholung);
    await payInFull(abholung.invoiceId, abholung.grossAmountCents);
    setSession(USERS.meister, "meister");
    await expect(recordGoodsOut(abholungInput)).resolves.toMatchObject({
      code: "OK",
      receipt: { paymentMode: "abholung", paymentStatus: "bezahlt", mode: "abholung" },
    });

    const rechnung = await createReadyOrder("Rechnung", "rechnung");
    const rechnungInput = {
      orderId: rechnung.orderId,
      mode: "versand" as const,
      expectedVersion: rechnung.version,
      clientEventId: randomUUID(),
    };
    setSession(USERS.admin, "admin");
    await expect(recordGoodsOut(rechnungInput)).resolves.toMatchObject({
      code: "OK",
      receipt: {
        paymentMode: "rechnung", paymentStatus: "offen",
        openAmountCents: rechnung.grossAmountCents, mode: "versand",
      },
    });
    const [invoiceState] = await sql<{ payment_status: string; payment_open_amount_cents: number; payment_version: number }[]>`
      SELECT payment_status, payment_open_amount_cents, payment_version
      FROM public.invoices WHERE id = ${rechnung.invoiceId}::uuid
    `;
    expect(invoiceState).toEqual({
      payment_status: "offen",
      payment_open_amount_cents: rechnung.grossAmountCents,
      payment_version: 0,
    });

    const [eventContract] = await sql<{
      event_type: string;
      aggregate_version: number;
      station: string;
      from_station: string;
      payload: Record<string, unknown>;
    }[]>`
      SELECT event_type, aggregate_version, station, from_station, payload
      FROM public.events
      WHERE tenant_id = ${TENANT}
        AND client_event_id = ${rechnungInput.clientEventId}::uuid
    `;
    expect(eventContract).toEqual({
      event_type: "ORDER_PICKED_UP_V1",
      aggregate_version: rechnung.version + 1,
      station: "abgeholt",
      from_station: "fertig",
      payload: {
        orderId: rechnung.orderId,
        mode: "versand",
        orderVersion: rechnung.version + 1,
        paymentMode: "rechnung",
        paymentStatus: "offen",
        openAmountCents: rechnung.grossAmountCents,
        gateAllowed: true,
      },
    });
  }, 60_000);
});
