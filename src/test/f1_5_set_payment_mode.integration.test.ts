// @vitest-environment node

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: expected the dedicated local F1.5 Postgres database");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

// AUTH_ADAPTER_SYNTHETIC_NOT_ACCEPTANCE: only the cookie/session adapter is
// synthetic. Intake, lifecycle, freeze, invoice, payment-mode, payment,
// transaction and receipt readbacks all use production code and the fresh DB.
const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));

const TENANT = "galvanik-kreile";
const FOREIGN_TENANT = "f15-b2-foreign";
const USERS = {
  buero: "25252525-2525-4252-8252-252525252501",
  meister: "25252525-2525-4252-8252-252525252502",
  admin: "25252525-2525-4252-8252-252525252503",
  werkstatt: "25252525-2525-4252-8252-252525252504",
} as const;
const CUSTOMER = "f15-b2-customer";
const FOREIGN_CUSTOMER = "f15-b2-foreign-customer";
const FOREIGN_ORDER = "f15-b2-foreign-order";
const SETTINGS = "f14-command-settings";
const RATE = "25252525-2525-4252-8252-252525252510";
const MODE_EVENTS = {
  buero: "25252525-2525-4252-8252-252525252520",
  stale: "25252525-2525-4252-8252-252525252521",
  meister: "25252525-2525-4252-8252-252525252522",
  admin: "25252525-2525-4252-8252-252525252523",
  postInvoice: "25252525-2525-4252-8252-252525252524",
  postPayment: "25252525-2525-4252-8252-252525252525",
  goodsOutLocked: "25252525-2525-4252-8252-252525252526",
  foreign: "25252525-2525-4252-8252-252525252527",
  forbidden: "25252525-2525-4252-8252-252525252528",
} as const;
const INTAKE_EVENT = "25252525-2525-4252-8252-252525252530";
const STATION_EVENT = "25252525-2525-4252-8252-252525252531";
const FREEZE_ID = "25252525-2525-4252-8252-252525252532";
const FREEZE_EVENT = "25252525-2525-4252-8252-252525252533";
const INVOICE_EVENT = "25252525-2525-4252-8252-252525252534";
const PAYMENT_EVENT = "25252525-2525-4252-8252-252525252535";
const GOODS_OUT_EVENT = "25252525-2525-4252-8252-252525252536";
const GOODS_OUT_CLIENT_EVENT = "25252525-2525-4252-8252-252525252537";
const GOODS_OUT_CORRELATION = "25252525-2525-4252-8252-252525252538";
const PAYMENT_FULL_EVENT = "25252525-2525-4252-8252-252525252539";

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });

function setSession(userId: string, role: keyof typeof USERS) {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId,
      tenantId: TENANT,
      role,
      displayName: `F1.5 B2 Synthetic ${role}`,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

async function assertFreshReset() {
  const [state] = await sql<{
    users: number;
    customers: number;
    orders: number;
    events: number;
    rate: number;
  }[]>`
    SELECT
      (SELECT count(*)::integer FROM public.app_users WHERE id IN (
        ${USERS.buero}::uuid, ${USERS.meister}::uuid, ${USERS.admin}::uuid, ${USERS.werkstatt}::uuid
      )) AS users,
      (SELECT count(*)::integer FROM public.customers WHERE id IN (${CUSTOMER}, ${FOREIGN_CUSTOMER})) AS customers,
      (SELECT count(*)::integer FROM public.orders WHERE id = ${FOREIGN_ORDER}) AS orders,
      (SELECT count(*)::integer FROM public.events WHERE client_event_id IN (
        ${MODE_EVENTS.buero}::uuid, ${MODE_EVENTS.meister}::uuid, ${MODE_EVENTS.admin}::uuid,
        ${MODE_EVENTS.postInvoice}::uuid, ${MODE_EVENTS.postPayment}::uuid,
        ${PAYMENT_EVENT}::uuid, ${PAYMENT_FULL_EVENT}::uuid, ${GOODS_OUT_CLIENT_EVENT}::uuid
      )) AS events,
      (SELECT count(*)::integer FROM private.extra_work_hourly_rates WHERE id = ${RATE}::uuid) AS rate
  `;
  expect(state).toEqual({ users: 0, customers: 0, orders: 0, events: 0, rate: 0 });
}

async function seedPrerequisites() {
  await sql.begin(async (transaction) => {
    for (const [role, userId] of Object.entries(USERS)) {
      await transaction`
        INSERT INTO public.app_users
          (id, tenant_id, email, full_name, role, active, created_at, updated_at)
        VALUES (
          ${userId}::uuid, ${TENANT}, ${`f15-b2-${role}@local.invalid`},
          ${`F1.5 B2 Synthetic ${role}`}, ${role}, true, now(), now()
        )
      `;
    }
    await transaction`
      INSERT INTO public.company_settings (
        id, tenant_id, company_name, street, zip, city, country,
        iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
        invoice_payment_term_days
      ) VALUES (
        ${SETTINGS}, ${TENANT}, 'F1.5 Synthetic Galvanik GmbH',
        'Testweg 1', '70173', 'Stuttgart', 'Deutschland',
        'DE02120300000000202051', 'BYLADEM1001', 'F1.5 Testbank',
        'DE-SYNTHETIC-TAX', 1900, 14
      )
      ON CONFLICT (id) DO UPDATE
      SET invoice_vat_rate_basis_points = EXCLUDED.invoice_vat_rate_basis_points
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type,
        street, zip_code, city, country, created_at, updated_at
      ) VALUES
        (
          ${CUSTOMER}, ${TENANT}, 'F15-B2-001', 'F1.5 B2 Synthetic Customer',
          'F1.5 B2 Synthetic Customer GmbH', 'business', 'Kundenweg 2',
          '70174', 'Stuttgart', 'Deutschland', now(), now()
        ),
        (
          ${FOREIGN_CUSTOMER}, ${FOREIGN_TENANT}, 'F15-B2-F', 'F1.5 B2 Foreign Customer',
          'F1.5 B2 Foreign Customer GmbH', 'business', 'Fremdweg 3',
          '20095', 'Hamburg', 'Deutschland', now(), now()
        )
    `;
    await transaction`
      INSERT INTO public.orders (
        id, tenant_id, order_number, customer_id, title, station,
        current_station, current_station_id, version, status, created_at
      ) VALUES (
        ${FOREIGN_ORDER}, ${FOREIGN_TENANT}, 'A-F15-B2-F', ${FOREIGN_CUSTOMER},
        'F1.5 B2 Foreign Order', 'wareneingang', 'wareneingang', 'wareneingang',
        1, 'angenommen', now()
      )
    `;
    await transaction`
      INSERT INTO private.extra_work_hourly_rates (
        id, tenant_id, hourly_rate_cents, version, created_by, effective_at
      ) VALUES (${RATE}::uuid, ${TENANT}, 12000, 900, ${USERS.admin}::uuid, now())
    `;
  });
}

async function readModeState(orderId: string) {
  const [state] = await sql<{
    payment_mode: string;
    payment_mode_version: number;
    event_count: number;
  }[]>`
    SELECT
      orders.payment_mode,
      orders.payment_mode_version,
      (
        SELECT count(*)::integer
        FROM public.events event
        WHERE event.tenant_id = orders.tenant_id
          AND event.order_id = orders.id
          AND event.event_type = 'PAYMENT_MODE_SET_V1'
      ) AS event_count
    FROM public.orders orders
    WHERE orders.id = ${orderId} AND orders.tenant_id = ${TENANT}
  `;
  if (!state) throw new Error("F1_5_B2_ORDER_STATE_MISSING");
  return state;
}

async function readInvoiceAndSummary(invoiceId: string) {
  return sql.begin(async (transaction) => {
    await transaction`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
    const [invoice] = await transaction<{
      invoice_id: string;
      order_id: string;
      gross_amount_cents: number;
      payment_mode: string;
      payment_status: string;
      payment_open_amount_cents: number;
      payment_paid_amount_cents: number;
      payment_version: number;
    }[]>`
      SELECT
        id::text AS invoice_id, order_id, gross_amount_cents, payment_mode,
        payment_status, payment_open_amount_cents, payment_paid_amount_cents,
        payment_version
      FROM public.invoices
      WHERE id = ${invoiceId}::uuid AND tenant_id = ${TENANT}
    `;
    const [summary] = await transaction<{
      payment_mode: string;
      payment_mode_version: number;
      payment_status: string;
      payment_open_amount_cents: number;
      goods_out_allowed: boolean;
      integrity_ok: boolean;
    }[]>`
      SELECT
        payment_mode, payment_mode_version, payment_status,
        payment_open_amount_cents, goods_out_allowed, integrity_ok
      FROM private.v_payment_summary_v1
      WHERE invoice_id = ${invoiceId}::uuid
    `;
    if (!invoice || !summary) throw new Error("F1_5_B2_PAYMENT_READBACK_MISSING");
    return { invoice, summary };
  });
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

describe("F1.5 D-F15-002 real intake/payment-mode contract — AUTH_ADAPTER_SYNTHETIC_NOT_ACCEPTANCE", () => {
  it("persists default Vorkasse, audits mode changes, snapshots issuance and blocks changes after goods out", async () => {
    await assertFreshReset();
    await seedPrerequisites();

    setSession(USERS.admin, "admin");
    const { createOrderIntake } = await import("@/lib/server/commands/orderIntakeCommand");
    const intake = await createOrderIntake({
      clientEventId: INTAKE_EVENT,
      customer: { mode: "EXISTING", customerId: CUSTOMER },
      dueDate: "2026-09-30",
      note: "F1.5 B2 canonical intake",
      items: [{
        name: "F1.5 B2 Werkstück",
        quantity: 1,
        material: "Stahl",
        surfaceRequested: "Galvanik",
      }],
    });
    expect(intake.code).toBe("OK");
    if (intake.code !== "OK") throw new Error(`F1_5_B2_INTAKE_FAILED:${intake.code}`);
    const orderId = intake.receipt.orderId;
    const itemId = intake.receipt.items[0]?.id;
    if (!itemId) throw new Error("F1_5_B2_ITEM_MISSING");
    expect(await readModeState(orderId)).toEqual({
      payment_mode: "vorkasse",
      payment_mode_version: 0,
      event_count: 0,
    });

    let directMutationError: unknown;
    try {
      await sql`
        UPDATE public.orders
        SET payment_mode = 'rechnung', payment_mode_version = 1
        WHERE id = ${orderId} AND tenant_id = ${TENANT}
      `;
    } catch (error) {
      directMutationError = error;
    }
    expect(directMutationError).toMatchObject({ code: "23514" });
    expect(await readModeState(orderId)).toEqual({
      payment_mode: "vorkasse",
      payment_mode_version: 0,
      event_count: 0,
    });

    const { setPaymentMode } = await import("@/lib/server/commands/setPaymentModeCommand");
    const bueroInput = {
      orderId,
      paymentMode: "abholung" as const,
      expectedVersion: 0,
      clientEventId: MODE_EVENTS.buero,
    };
    setSession(USERS.buero, "buero");
    const bueroChange = await setPaymentMode(bueroInput);
    expect(bueroChange).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        orderId,
        previousPaymentMode: "vorkasse",
        paymentMode: "abholung",
        expectedVersion: 0,
        paymentModeVersion: 1,
        changedBy: USERS.buero,
      },
    });
    expect(bueroChange.code).toBe("OK");
    if (bueroChange.code !== "OK") throw new Error("F1_5_B2_BUERO_MODE_FAILED");
    setSession(USERS.buero, "buero");
    await expect(setPaymentMode(bueroInput)).resolves.toEqual({
      code: "OK",
      receipt: bueroChange.receipt,
      replayed: true,
    });
    setSession(USERS.buero, "buero");
    await expect(setPaymentMode({ ...bueroInput, paymentMode: "rechnung" })).resolves.toMatchObject({
      code: "CONFLICT",
    });
    setSession(USERS.buero, "buero");
    await expect(setPaymentMode({
      orderId,
      paymentMode: "rechnung",
      expectedVersion: 0,
      clientEventId: MODE_EVENTS.stale,
    })).resolves.toMatchObject({ code: "CONFLICT" });

    setSession(USERS.meister, "meister");
    await expect(setPaymentMode({
      orderId,
      paymentMode: "rechnung",
      expectedVersion: 1,
      clientEventId: MODE_EVENTS.meister,
    })).resolves.toMatchObject({
      code: "OK",
      replayed: false,
      receipt: { previousPaymentMode: "abholung", paymentMode: "rechnung", paymentModeVersion: 2 },
    });
    setSession(USERS.admin, "admin");
    await expect(setPaymentMode({
      orderId,
      paymentMode: "vorkasse",
      expectedVersion: 2,
      clientEventId: MODE_EVENTS.admin,
    })).resolves.toMatchObject({
      code: "OK",
      replayed: false,
      receipt: { previousPaymentMode: "rechnung", paymentMode: "vorkasse", paymentModeVersion: 3 },
    });

    const beforeForbidden = await readModeState(orderId);
    setSession(USERS.werkstatt, "werkstatt");
    await expect(setPaymentMode({
      orderId,
      paymentMode: "abholung",
      expectedVersion: 3,
      clientEventId: MODE_EVENTS.forbidden,
    })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(await readModeState(orderId)).toEqual(beforeForbidden);

    const [foreignBefore] = await sql<{ payment_mode: string; payment_mode_version: number }[]>`
      SELECT payment_mode, payment_mode_version FROM public.orders WHERE id = ${FOREIGN_ORDER}
    `;
    setSession(USERS.buero, "buero");
    await expect(setPaymentMode({
      orderId: FOREIGN_ORDER,
      paymentMode: "rechnung",
      expectedVersion: 0,
      clientEventId: MODE_EVENTS.foreign,
    })).resolves.toMatchObject({ code: "NOT_FOUND" });
    const [foreignAfter] = await sql<{ payment_mode: string; payment_mode_version: number }[]>`
      SELECT payment_mode, payment_mode_version FROM public.orders WHERE id = ${FOREIGN_ORDER}
    `;
    expect(foreignAfter).toEqual(foreignBefore);

    setSession(USERS.admin, "admin");
    const { transitionWareneingangToGalvanik } = await import("@/lib/server/commands/orderStationCommand");
    const station = await transitionWareneingangToGalvanik({
      orderId,
      expectedVersion: intake.receipt.orderVersion,
      clientEventId: STATION_EVENT,
    });
    expect(station.code).toBe("OK");
    if (station.code !== "OK") throw new Error(`F1_5_B2_STATION_FAILED:${station.code}`);
    await sql`
      UPDATE public.items
      SET preis_netto = 100.00
      WHERE id = ${itemId} AND order_id = ${orderId} AND tenant_id = ${TENANT}
    `;

    setSession(USERS.admin, "admin");
    const { freezeOrder } = await import("@/lib/server/commands/orderFreezeCommand");
    const frozen = await freezeOrder({
      orderId,
      freezeId: FREEZE_ID,
      expectedVersion: station.receipt.aggregateVersion,
      clientEventId: FREEZE_EVENT,
    });
    expect(frozen.code).toBe("OK");
    if (frozen.code !== "OK") throw new Error(`F1_5_B2_FREEZE_FAILED:${frozen.code}`);

    setSession(USERS.admin, "admin");
    const { createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
    const issued = await createInvoice({
      orderId,
      expectedVersion: frozen.receipt.aggregateVersion,
      clientEventId: INVOICE_EVENT,
    });
    expect(issued.code).toBe("OK");
    if (issued.code !== "OK") throw new Error(`F1_5_B2_INVOICE_FAILED:${issued.code}`);
    const invoiceId = issued.receipt.invoiceId;
    expect(await readInvoiceAndSummary(invoiceId)).toMatchObject({
      invoice: {
        invoice_id: invoiceId,
        order_id: orderId,
        gross_amount_cents: 11900,
        payment_mode: "vorkasse",
        payment_status: "offen",
        payment_open_amount_cents: 11900,
        payment_paid_amount_cents: 0,
        payment_version: 0,
      },
      summary: {
        payment_mode: "vorkasse",
        payment_mode_version: 3,
        payment_status: "offen",
        goods_out_allowed: false,
        integrity_ok: true,
      },
    });

    setSession(USERS.admin, "admin");
    await expect(setPaymentMode({
      orderId,
      paymentMode: "rechnung",
      expectedVersion: 3,
      clientEventId: MODE_EVENTS.postInvoice,
    })).resolves.toMatchObject({ code: "OK", receipt: { paymentModeVersion: 4 } });
    expect(await readInvoiceAndSummary(invoiceId)).toMatchObject({
      invoice: { payment_mode: "vorkasse", payment_status: "offen" },
      summary: {
        payment_mode: "rechnung",
        payment_mode_version: 4,
        goods_out_allowed: true,
        integrity_ok: true,
      },
    });

    const paymentInput = {
      invoiceId,
      amount: 4_000,
      method: "ueberweisung" as const,
      expectedVersion: 0,
      clientEventId: PAYMENT_EVENT,
    };
    setSession(USERS.buero, "buero");
    const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");
    const partial = await confirmPayment(paymentInput);
    expect(partial).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        invoiceId,
        orderId,
        paymentMode: "vorkasse",
        paymentStatus: "teilbezahlt",
        paidAmountCents: 4_000,
        openAmountCents: 7_900,
      },
    });
    expect(partial.code).toBe("OK");
    if (partial.code !== "OK") throw new Error("F1_5_B2_PAYMENT_FAILED");

    setSession(USERS.meister, "meister");
    await expect(setPaymentMode({
      orderId,
      paymentMode: "abholung",
      expectedVersion: 4,
      clientEventId: MODE_EVENTS.postPayment,
    })).resolves.toMatchObject({ code: "OK", receipt: { paymentModeVersion: 5 } });
    setSession(USERS.buero, "buero");
    await expect(confirmPayment(paymentInput)).resolves.toEqual({
      code: "OK",
      receipt: partial.receipt,
      replayed: true,
    });

    setSession(USERS.admin, "admin");
    await expect(confirmPayment({
      invoiceId,
      amount: 7_900,
      method: "bar",
      expectedVersion: 1,
      clientEventId: PAYMENT_FULL_EVENT,
    })).resolves.toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        invoiceId,
        orderId,
        paymentMode: "vorkasse",
        paymentStatus: "bezahlt",
        paidAmountCents: 11_900,
        openAmountCents: 0,
        paymentVersion: 2,
      },
    });

    setSession(USERS.admin, "admin");
    await expect(setPaymentMode({
      orderId,
      paymentMode: "rechnung",
      expectedVersion: 5,
      clientEventId: MODE_EVENTS.goodsOutLocked,
    })).resolves.toMatchObject({ code: "OK", receipt: { paymentModeVersion: 6 } });

    await sql`
      INSERT INTO public.events (
        id, tenant_id, order_id, item_id, event_type, description, user_id,
        payload, status, station, created_at, client_event_id,
        event_schema_version, correlation_id, aggregate_version, from_station
      ) VALUES (
        ${GOODS_OUT_EVENT}, ${TENANT}, ${orderId}, NULL, 'ORDER_PICKED_UP_V1',
        'F1.5 B2 synthetic goods-out boundary', ${USERS.admin}::uuid,
        ${sql.json({
          orderId,
          mode: "versand",
          orderVersion: frozen.receipt.aggregateVersion,
          paymentMode: "rechnung",
          paymentStatus: "bezahlt",
          openAmountCents: 0,
          gateAllowed: true,
        })},
        'success', 'abgeholt', now(), ${GOODS_OUT_CLIENT_EVENT}::uuid,
        1, ${GOODS_OUT_CORRELATION}::uuid, ${frozen.receipt.aggregateVersion}, 'fertig'
      )
    `;
    const lockedState = await readModeState(orderId);
    setSession(USERS.admin, "admin");
    await expect(setPaymentMode({
      orderId,
      paymentMode: "vorkasse",
      expectedVersion: 6,
      clientEventId: randomUUID(),
    })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await readModeState(orderId)).toEqual(lockedState);

    const [modeEventCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.events
      WHERE tenant_id = ${TENANT}
        AND order_id = ${orderId}
        AND event_type = 'PAYMENT_MODE_SET_V1'
    `;
    expect(modeEventCount?.count).toBe(6);
  });
});
