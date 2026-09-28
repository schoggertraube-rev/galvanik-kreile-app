// @vitest-environment node
//
// B2 / G04: Integrationsnachweis des Termintreue-Lesevertrags
// getOrderTimelinessFacts gegen die REALEN Views
// public.v_order_timeliness_orders_v1 und
// public.v_order_timeliness_pickup_events_v1
// (supabase/migrations/20260927120000_b2_order_timeliness_read_contract.sql,
// _MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md Z.14/Z.91/Z.98).
//
// Es gibt hier keinen Fake und keine Domaenen-Attrappe: jede Zeile wird als
// echte Fixture in public.orders bzw. public.events geschrieben, und jeder Fakt
// wird ueber die oeffentliche Server-Fassade des Moduls gelesen. Geprueft werden
// die vier Gruppen des Auftrags: Autorisierung, zwei Tenants (Isolation),
// Bereichsgrenzen und das reale public.v_*-Mapping.
//
// Muster uebernommen von src/test/werkstatt_kpi_contract.integration.test.ts
// (env-Guard, postgres-Fixture-Client, gemockte Autorisierung, Aufraeumen in
// afterAll). Zwei bewusste Abweichungen, beide fachlich erzwungen:
//
//  1. Die Fixtures entstehen in beforeAll, nicht in beforeEach. Abhol-Ereignisse
//     sind GoBD-append-only (events_f15_payment_delete_guard /
//     events_f15_v2_delete_guard -> public.prevent_audit_mutation), lassen sich
//     also nicht je Test neu anlegen und wieder entfernen.
//  2. Aus demselben Grund raeumt afterAll nur, was der Append-only-Vertrag
//     freigibt: die Auftraege OHNE Abhol-Ereignis. Die drei Auftraege MIT
//     Ereignis bleiben mitsamt Ereignis, Kunde und Nutzer stehen — genau wie in
//     src/test/f1_5_goods_out.integration.test.ts. Deshalb haengt der CI-Schritt
//     hinter dem ungepinnten `supabase db reset`, und alle Fixture-Kennungen
//     tragen einen Laufsuffix, damit ein zweiter Lauf auf derselben Datenbank
//     nicht kollidiert.

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { OrderTimelinessFact } from "@/modules/orders/server-public";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (
  process.env.DATABASE_URL !== LOCAL_DATABASE_URL
  || process.env.ORDER_TIMELINESS_EXPECTED_DATABASE_URL !== LOCAL_DATABASE_URL
) {
  throw new Error(
    "ORDER_TIMELINESS_LOCAL_DATABASE_REQUIRED: DATABASE_URL and ORDER_TIMELINESS_EXPECTED_DATABASE_URL must target 127.0.0.1:54322/postgres",
  );
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "ORDER_TIMELINESS_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset",
  );
}

const resolveAuthorization = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));

const READ_PERMISSION = "perm_view_leitstand";
const ORDERS_VIEW = "v_order_timeliness_orders_v1";
const PICKUP_EVENTS_VIEW = "v_order_timeliness_pickup_events_v1";

/** Deklarierter Spaltensatz der Auftrags-View (Migration + OrderContractRow). */
const ORDERS_VIEW_COLUMNS = [
  "completed_date",
  "due_date",
  "id",
  "order_number",
  "status",
  "tenant_id",
  "version",
] as const;

/** Deklarierter Spaltensatz der Abholereignis-View (Migration + PickupEventContractRow). */
const PICKUP_EVENTS_VIEW_COLUMNS = [
  "aggregate_version",
  "created_at",
  "event_id",
  "event_schema_version",
  "event_type",
  "from_station",
  "order_id",
  "payload_gate_allowed",
  "payload_invoice_state",
  "payload_mode",
  "payload_order_id",
  "payload_payment_mode",
  "station",
  "status",
  "tenant_id",
] as const;

/**
 * Felder, die den Vertrag NIE verlassen duerfen: das rohe payload-jsonb und die
 * Finanzfakten aus dem ORDER_PICKED_UP_V1-Payload
 * (events_order_picked_up_v1_contract_chk, 20260905100000). Beide Schreibweisen,
 * damit auch eine camelCase-Spalte auffaellt.
 */
const FORBIDDEN_VIEW_COLUMNS = [
  "payload",
  "paymentstatus",
  "payment_status",
  "openamountcents",
  "open_amount_cents",
];

/**
 * Die drei payload_*-Gatterfelder (payload_payment_mode, payload_invoice_state,
 * payload_gate_allowed) stehen ABSICHTLICH im Spaltensatz der Ereignis-View: die
 * Domaene prueft mit ihnen die Gueltigkeit eines Abholereignisses
 * (isValidPickupEventV2). Sie sind damit Gatter-, nicht Finanzfakten — Betrag und
 * Zahlstatus bleiben draussen (FORBIDDEN_VIEW_COLUMNS). Damit die Grenze nicht
 * auf dieser Zusicherung ruht, beweist der Test unten zusaetzlich die Schicht,
 * die M02 wirklich erreicht: im Read-DTO des Ports darf weder ein Zahlungs- oder
 * Rechnungsschluessel noch einer dieser payload-Werte auftauchen.
 */
const FORBIDDEN_FACT_KEY_PATTERN = /payment|invoice|amount|price|betrag|rechnung|zahl/i;

/**
 * Werte, die in den Fixture-Payloads nachweislich stehen (V1: paymentStatus
 * 'offen', openAmountCents 11900, paymentMode 'rechnung'; V2: paymentMode
 * 'rechnung', invoiceState 'not_issued') beziehungsweise ein Storno anzeigen
 * wuerden. Keiner davon darf im Read-DTO landen. Bewusst ohne die Zahl 11900:
 * der Laufsuffix ist eine Millisekundenzahl und koennte sie zufaellig enthalten.
 */
const FORBIDDEN_FACT_VALUES = [
  "rechnung",
  "not_issued",
  "offen",
  "paymentstatus",
  "openamountcents",
  "storno",
  "cancelled",
  "abgebrochen",
];

/** Trennt Schluessel und String-Werte eines Read-DTOs, beliebig tief. */
function collectKeysAndStrings(
  value: unknown,
  keys: string[],
  strings: string[],
): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeysAndStrings(entry, keys, strings);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key);
      collectKeysAndStrings(entry, keys, strings);
    }
    return;
  }
  if (typeof value === "string") strings.push(value);
}

const TENANT_A = KREILE_TENANT_SLUG;
const TENANT_B = "order-timeliness-tenant-b";
const RANGE = { from: "2026-07-10", to: "2026-07-20" };
/** Engeres Fenster: beweist, dass die Grenze der Filter ist, nicht die Fixture. */
const INNER_RANGE = { from: "2026-07-11", to: "2026-07-19" };

/**
 * Die beiden Tage unmittelbar ausserhalb von RANGE. Als Konstanten, weil sie an
 * zwei Stellen gebraucht werden — in der Fixture und in der Gegenprobe, dass die
 * View selbst NICHT nach Datum filtert. Ein Auseinanderlaufen beider Stellen
 * wuerde den Grenzfallbeweis still entwerten.
 */
const DAY_BEFORE_FROM = "2026-07-09";
const DAY_AFTER_TO = "2026-07-21";

const INTAKE_AT = "2026-07-01T08:00:00.000Z";

const suffix = `${Date.now()}-${process.pid}`;
const label = (name: string) => `otf-${name}-${suffix}`;

const USER_A = randomUUID();
const USER_B = randomUUID();
const CUSTOMER_A = label("customer-a");
const CUSTOMER_B = label("customer-b");

/** Auftraege ohne Abhol-Ereignis; nur diese lassen sich wieder loeschen. */
const DELETABLE = {
  aBefore: label("a-before"),
  aFrom: label("a-from"),
  aTo: label("a-to"),
  aToEnd: label("a-to-end"),
  aAfter: label("a-after"),
  bInWindow: label("b-in-window"),
};
/** Auftraege mit append-only Abhol-Ereignis; bleiben in der Datenbank. */
const PERSISTENT = {
  aPickedUp: label("a-picked-up"),
  aV1Only: label("a-v1-only"),
  bPickedUp: label("b-picked-up"),
};

const EVENT_IDS = {
  aPickedUpV2: label("event-a-v2"),
  aV1Only: label("event-a-v1"),
  bPickedUpV2: label("event-b-v2"),
};

const ORDER_NUMBERS = {
  aBefore: `A-OTF-1-BEFORE-${suffix}`,
  aFrom: `A-OTF-2-FROM-${suffix}`,
  aPickedUp: `A-OTF-3-PICKED-${suffix}`,
  aV1Only: `A-OTF-4-V1-${suffix}`,
  aTo: `A-OTF-5-TO-${suffix}`,
  aToEnd: `A-OTF-6-TOEND-${suffix}`,
  aAfter: `A-OTF-7-AFTER-${suffix}`,
  bPickedUp: `B-OTF-1-PICKED-${suffix}`,
  bInWindow: `B-OTF-2-IN-${suffix}`,
};

/** Erwartete Zeitpunkte; exakt die Werte, die die Fixtures schreiben. */
const A_PICKED_UP_COMPLETED_AT = "2026-07-15T09:00:00.000Z";
const A_PICKED_UP_AT = "2026-07-15T10:00:00.000Z";
const A_V1_COMPLETED_AT = "2026-07-16T11:00:00.000Z";
const A_V1_EVENT_AT = "2026-07-16T12:00:00.000Z";
const B_PICKED_UP_COMPLETED_AT = "2026-07-15T13:00:00.000Z";
const B_PICKED_UP_AT = "2026-07-15T14:00:00.000Z";

const A_PICKED_UP_VERSION = 3;
const A_V1_VERSION = 2;
const B_PICKED_UP_VERSION = 4;

const fixtureSql = postgres(LOCAL_DATABASE_URL, { max: 1, prepare: false });

let getOrderTimelinessFacts: typeof import("@/modules/orders/server-public").getOrderTimelinessFacts;

function authorize(tenantId: string, permissions: readonly string[] = [READ_PERMISSION]) {
  resolveAuthorization.mockResolvedValue({
    ok: true,
    data: {
      userId: tenantId === TENANT_B ? USER_B : USER_A,
      tenantId,
      displayName: "Termintreue Fixture",
      role: "admin",
      permissions,
      active: true,
    },
  });
}

async function readFacts(tenantId: string, range: { from: string; to: string }) {
  authorize(tenantId);
  const result = await getOrderTimelinessFacts(range);
  expect(result.code).toBe("OK");
  if (result.code !== "OK") throw new Error(`ORDER_TIMELINESS_READ_FAILED:${result.code}`);
  return result.data;
}

/** Alle Ereigniskennungen, die als Provenienz eines Abholzeitpunkts austreten. */
function pickupEventIds(facts: { facts: readonly OrderTimelinessFact[] }): string[] {
  return facts.facts.flatMap((fact) =>
    fact.pickedUpAt.provenance?.kind === "event" ? [fact.pickedUpAt.provenance.eventId] : []);
}

async function seedTenant(tenantId: string, userId: string, customerId: string, name: string) {
  await fixtureSql`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (
      ${userId}::uuid, ${tenantId}, ${`${name}@local.invalid`},
      'Termintreue Fixture Nutzer', 'admin', true, now(), now()
    )
  `;
  await fixtureSql`
    INSERT INTO public.customers (id, tenant_id, customer_number, name, type, source)
    VALUES (${customerId}, ${tenantId}, ${name}, 'Termintreue Fixture Kunde', 'business', 'manual')
  `;
}

type OrderFixture = {
  id: string;
  tenantId: string;
  customerId: string;
  orderNumber: string;
  /** timestamp ohne Zone, wie public.orders.due_date. */
  dueDate: string;
  /** timestamptz, wie public.orders.completed_date. */
  completedDate: string | null;
  status: string;
  version: number;
};

async function insertOrder(fixture: OrderFixture) {
  // payment_mode/payment_mode_version bleiben auf dem Intake-Default: der
  // Trigger orders_f15_payment_mode_insert_guard verlangt ('vorkasse', 0).
  await fixtureSql`
    INSERT INTO public.orders (
      id, tenant_id, order_number, customer_id, title, station, current_station,
      current_station_id, status, version, source, intake_date, due_date, completed_date
    ) VALUES (
      ${fixture.id}, ${fixture.tenantId}, ${fixture.orderNumber}, ${fixture.customerId},
      'Termintreue Fixture Auftrag', ${fixture.status}, ${fixture.status},
      ${fixture.status}, ${fixture.status}, ${fixture.version}, 'manual',
      ${INTAKE_AT}::timestamptz AT TIME ZONE 'UTC',
      ${fixture.dueDate}::timestamp, ${fixture.completedDate}::timestamptz
    )
  `;
}

/**
 * Ein Auftrag im Zustand `abgeholt` mit genau einem vertragsgueltigen
 * ORDER_PICKED_UP_V2-Ereignis. Der Weg dorthin ist nicht verkuerzbar:
 * private.validate_f15_v2_event_insert verlangt payment_mode = 'rechnung',
 * orders.version = aggregate_version und alle vier Stationsfelder auf
 * 'abgeholt', und guard_f1_5_order_payment_mode_update laesst den Wechsel auf
 * 'rechnung' nur VOR dem Stationswechsel und nur mit gesetztem Command-Flag zu.
 */
async function seedPickedUpOrder(params: {
  order: OrderFixture;
  userId: string;
  eventId: string;
  pickedUpAt: string;
}) {
  await insertOrder({ ...params.order, status: "fertig" });
  await fixtureSql.begin(async (tx) => {
    await tx`SELECT set_config('app.payment_mode_command', 'v1', true)`;
    await tx`
      UPDATE public.orders
      SET payment_mode = 'rechnung', payment_mode_version = 1
      WHERE id = ${params.order.id} AND tenant_id = ${params.order.tenantId}
    `;
  });
  await fixtureSql`
    UPDATE public.orders
    SET station = 'abgeholt', current_station = 'abgeholt',
        current_station_id = 'abgeholt', status = 'abgeholt'
    WHERE id = ${params.order.id} AND tenant_id = ${params.order.tenantId}
  `;
  await fixtureSql`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, client_event_id, event_schema_version,
      correlation_id, aggregate_version, from_station, created_at
    ) VALUES (
      ${params.eventId}, ${params.order.tenantId}, ${params.order.id}, NULL,
      'ORDER_PICKED_UP_V2', 'Termintreue Fixture Abholung', ${params.userId}::uuid,
      ${fixtureSql.json({
        orderId: params.order.id,
        mode: "abholung",
        orderVersion: params.order.version,
        paymentMode: "rechnung",
        invoiceState: "not_issued",
        gateAllowed: true,
      })}::jsonb,
      'success', 'abgeholt', ${randomUUID()}::uuid, 2, ${randomUUID()}::uuid,
      ${params.order.version}, 'fertig', ${params.pickedUpAt}::timestamptz AT TIME ZONE 'UTC'
    )
  `;
}

/**
 * Ein Auftrag mit ausschliesslich einem ORDER_PICKED_UP_V1-Ereignis. Dessen
 * Payload traegt die Finanzfelder paymentStatus und openAmountCents — genau die
 * Felder, die der Readvertrag nicht durchreichen darf.
 */
async function seedV1OnlyOrder(params: {
  order: OrderFixture;
  userId: string;
  eventId: string;
  occurredAt: string;
}) {
  await insertOrder(params.order);
  await fixtureSql`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, client_event_id, event_schema_version,
      correlation_id, aggregate_version, from_station, created_at
    ) VALUES (
      ${params.eventId}, ${params.order.tenantId}, ${params.order.id}, NULL,
      'ORDER_PICKED_UP_V1', 'Termintreue Fixture Altvertrag', ${params.userId}::uuid,
      ${fixtureSql.json({
        orderId: params.order.id,
        mode: "abholung",
        orderVersion: params.order.version,
        paymentMode: "rechnung",
        paymentStatus: "offen",
        openAmountCents: 11900,
        gateAllowed: true,
      })}::jsonb,
      'success', 'abgeholt', ${randomUUID()}::uuid, 1, ${randomUUID()}::uuid,
      ${params.order.version}, 'fertig', ${params.occurredAt}::timestamptz AT TIME ZONE 'UTC'
    )
  `;
}

beforeAll(async () => {
  ({ getOrderTimelinessFacts } = await import("@/modules/orders/server-public"));

  await seedTenant(TENANT_A, USER_A, CUSTOMER_A, label("user-a"));
  await seedTenant(TENANT_B, USER_B, CUSTOMER_B, label("user-b"));

  const plainA = (id: string, orderNumber: string, dueDate: string): OrderFixture => ({
    id,
    tenantId: TENANT_A,
    customerId: CUSTOMER_A,
    orderNumber,
    dueDate,
    completedDate: null,
    status: "galvanik",
    version: 1,
  });

  // Bereichsgrenzen: ein Tag vor `from`, exakt `from`, exakt `to`, spaeter Tag
  // von `to` und ein Tag nach `to`.
  await insertOrder(plainA(DELETABLE.aBefore, ORDER_NUMBERS.aBefore, `${DAY_BEFORE_FROM}T00:00:00`));
  await insertOrder(plainA(DELETABLE.aFrom, ORDER_NUMBERS.aFrom, "2026-07-10T00:00:00"));
  await insertOrder(plainA(DELETABLE.aTo, ORDER_NUMBERS.aTo, "2026-07-20T00:00:00"));
  await insertOrder(plainA(DELETABLE.aToEnd, ORDER_NUMBERS.aToEnd, "2026-07-20T23:30:00"));
  await insertOrder(plainA(DELETABLE.aAfter, ORDER_NUMBERS.aAfter, `${DAY_AFTER_TO}T00:00:00`));

  await seedPickedUpOrder({
    order: {
      id: PERSISTENT.aPickedUp,
      tenantId: TENANT_A,
      customerId: CUSTOMER_A,
      orderNumber: ORDER_NUMBERS.aPickedUp,
      dueDate: "2026-07-15T00:00:00",
      completedDate: A_PICKED_UP_COMPLETED_AT,
      status: "abgeholt",
      version: A_PICKED_UP_VERSION,
    },
    userId: USER_A,
    eventId: EVENT_IDS.aPickedUpV2,
    pickedUpAt: A_PICKED_UP_AT,
  });

  await seedV1OnlyOrder({
    order: {
      id: PERSISTENT.aV1Only,
      tenantId: TENANT_A,
      customerId: CUSTOMER_A,
      orderNumber: ORDER_NUMBERS.aV1Only,
      dueDate: "2026-07-16T00:00:00",
      completedDate: A_V1_COMPLETED_AT,
      status: "fertig",
      version: A_V1_VERSION,
    },
    userId: USER_A,
    eventId: EVENT_IDS.aV1Only,
    occurredAt: A_V1_EVENT_AT,
  });

  await insertOrder({
    id: DELETABLE.bInWindow,
    tenantId: TENANT_B,
    customerId: CUSTOMER_B,
    orderNumber: ORDER_NUMBERS.bInWindow,
    dueDate: "2026-07-11T00:00:00",
    completedDate: null,
    status: "galvanik",
    version: 1,
  });

  await seedPickedUpOrder({
    order: {
      id: PERSISTENT.bPickedUp,
      tenantId: TENANT_B,
      customerId: CUSTOMER_B,
      orderNumber: ORDER_NUMBERS.bPickedUp,
      dueDate: "2026-07-15T00:00:00",
      completedDate: B_PICKED_UP_COMPLETED_AT,
      status: "abgeholt",
      version: B_PICKED_UP_VERSION,
    },
    userId: USER_B,
    eventId: EVENT_IDS.bPickedUpV2,
    pickedUpAt: B_PICKED_UP_AT,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  // Nur die Auftraege ohne Abhol-Ereignis sind loeschbar; die drei Auftraege mit
  // Ereignis, ihre Kunden und Nutzer bleiben (Append-only, siehe Kopfkommentar).
  await fixtureSql`
    DELETE FROM public.orders WHERE id = ANY(${Object.values(DELETABLE)})
  `;
  await fixtureSql.end({ timeout: 1 });
});

describe("getOrderTimelinessFacts Autorisierung", () => {
  it("liefert ohne gesetzte GUC app.tenant_id aus beiden Views kein Ergebnis", async () => {
    // Fixture-Client ohne Transaktion und damit ohne app.tenant_id: der
    // Zeilenfilter beider Views faellt fail-closed auf ein leeres Resultset.
    const orderRows = await fixtureSql`SELECT * FROM public.v_order_timeliness_orders_v1`;
    const eventRows = await fixtureSql`SELECT * FROM public.v_order_timeliness_pickup_events_v1`;
    expect(orderRows).toEqual([]);
    expect(eventRows).toEqual([]);
  });

  it("verweigert eine Rolle ohne perm_view_leitstand", async () => {
    authorize(TENANT_A, []);
    await expect(getOrderTimelinessFacts(RANGE)).resolves.toMatchObject({ code: "FORBIDDEN" });

    authorize(TENANT_A, ["perm_view_auftraege"]);
    await expect(getOrderTimelinessFacts(RANGE)).resolves.toMatchObject({ code: "FORBIDDEN" });
  });

  it("haelt beide Views invoker-safe und fuer Browser-Rollen unerreichbar", async () => {
    for (const view of [ORDERS_VIEW, PICKUP_EVENTS_VIEW]) {
      const [security] = await fixtureSql<{
        security_invoker: boolean;
        service_select: boolean;
        anon_select: boolean;
        authenticated_select: boolean;
      }[]>`
        SELECT
          coalesce('security_invoker=true' = ANY(coalesce(cls.reloptions, ARRAY[]::text[])), false)
            AS security_invoker,
          has_table_privilege('service_role', ${`public.${view}`}, 'SELECT') AS service_select,
          has_table_privilege('anon', ${`public.${view}`}, 'SELECT') AS anon_select,
          has_table_privilege('authenticated', ${`public.${view}`}, 'SELECT')
            AS authenticated_select
        FROM pg_class cls
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public' AND cls.relname = ${view}
      `;
      expect({ view, security }).toEqual({
        view,
        security: {
          security_invoker: true,
          service_select: true,
          anon_select: false,
          authenticated_select: false,
        },
      });
    }
  });
});

describe("getOrderTimelinessFacts Tenant-Isolation", () => {
  it("zeigt Tenant A nie Auftraege oder Ereignisse von Tenant B", async () => {
    const facts = await readFacts(TENANT_A, RANGE);
    const orderIds = facts.facts.map((fact) => fact.orderId);
    const eventIds = pickupEventIds(facts);

    expect(orderIds).toContain(PERSISTENT.aPickedUp);
    expect(orderIds).toContain(PERSISTENT.aV1Only);
    expect(orderIds).not.toContain(PERSISTENT.bPickedUp);
    expect(orderIds).not.toContain(DELETABLE.bInWindow);
    expect(eventIds).toContain(EVENT_IDS.aPickedUpV2);
    expect(eventIds).not.toContain(EVENT_IDS.bPickedUpV2);

    const aPickedUp = facts.facts.find((fact) => fact.orderId === PERSISTENT.aPickedUp);
    expect(aPickedUp).toEqual({
      schemaVersion: 1,
      orderId: PERSISTENT.aPickedUp,
      orderNumber: ORDER_NUMBERS.aPickedUp,
      orderVersion: A_PICKED_UP_VERSION,
      lifecycleStatus: "abgeholt",
      promisedDate: {
        value: "2026-07-15",
        source: "orders.due_date",
        provenance: { kind: "column", relation: "public.orders", column: "due_date" },
        missingReason: null,
      },
      finishedAt: {
        value: A_PICKED_UP_COMPLETED_AT,
        source: "orders.completed_date",
        provenance: { kind: "column", relation: "public.orders", column: "completed_date" },
        missingReason: null,
      },
      pickedUpAt: {
        value: A_PICKED_UP_AT,
        source: "events.ORDER_PICKED_UP_V2.created_at",
        provenance: {
          kind: "event",
          relation: "public.events",
          eventId: EVENT_IDS.aPickedUpV2,
          eventType: "ORDER_PICKED_UP_V2",
          eventSchemaVersion: 2,
          aggregateVersion: A_PICKED_UP_VERSION,
        },
        missingReason: null,
      },
      cancellationClass: {
        value: null,
        source: null,
        provenance: null,
        missingReason: "Q-G04-002 In Klaerung",
      },
      consistency: [],
    });

    // Der V1-Auftrag beweist die Gegenprobe: das Ereignis ist da, aber der
    // Abholzeitpunkt bleibt ohne V2-Vertrag unbelegt.
    const aV1Only = facts.facts.find((fact) => fact.orderId === PERSISTENT.aV1Only);
    expect(aV1Only?.pickedUpAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: "pickup_event_contract_v1_only",
    });
    expect(aV1Only?.finishedAt.value).toBe(A_V1_COMPLETED_AT);
  });

  it("zeigt Tenant B nie Auftraege oder Ereignisse von Tenant A", async () => {
    const facts = await readFacts(TENANT_B, RANGE);
    const orderIds = facts.facts.map((fact) => fact.orderId);
    const eventIds = pickupEventIds(facts);

    expect(orderIds).toContain(PERSISTENT.bPickedUp);
    expect(orderIds).toContain(DELETABLE.bInWindow);
    for (const foreignOrderId of [
      PERSISTENT.aPickedUp,
      PERSISTENT.aV1Only,
      DELETABLE.aFrom,
      DELETABLE.aTo,
      DELETABLE.aToEnd,
      DELETABLE.aBefore,
      DELETABLE.aAfter,
    ]) {
      expect(orderIds).not.toContain(foreignOrderId);
    }
    expect(eventIds).toContain(EVENT_IDS.bPickedUpV2);
    expect(eventIds).not.toContain(EVENT_IDS.aPickedUpV2);
    expect(eventIds).not.toContain(EVENT_IDS.aV1Only);

    const bPickedUp = facts.facts.find((fact) => fact.orderId === PERSISTENT.bPickedUp);
    expect(bPickedUp?.pickedUpAt).toEqual({
      value: B_PICKED_UP_AT,
      source: "events.ORDER_PICKED_UP_V2.created_at",
      provenance: {
        kind: "event",
        relation: "public.events",
        eventId: EVENT_IDS.bPickedUpV2,
        eventType: "ORDER_PICKED_UP_V2",
        eventSchemaVersion: 2,
        aggregateVersion: B_PICKED_UP_VERSION,
      },
      missingReason: null,
    });
    expect(bPickedUp?.finishedAt.value).toBe(B_PICKED_UP_COMPLETED_AT);
  });

  it("zeigt beim direkten Read gegen beide Views nie eine Fremdtenant-Zeile", async () => {
    // Die beiden Tests darueber beweisen die Isolation ueber den Port. Dieser
    // Test greift eine Schicht tiefer und liest beide Views direkt mit gesetzter
    // GUC: der Zeilenfilter der View muss allein tragen, auch ohne den
    // zusaetzlichen tenant_id-Filter des Ports. Bewusst ohne Fenster- und
    // Auftragsfilter — was die View unter dieser GUC ueberhaupt hergibt, ist der
    // Beweis. Deshalb keine Zeilenzahl-Erwartung: die Datenbank traegt
    // Append-only-Reste aus fruheren Laeufen und CI-Schritten.
    const cases = [
      {
        tenantId: TENANT_A,
        ownOrderIds: [PERSISTENT.aPickedUp, PERSISTENT.aV1Only],
        ownEventIds: [EVENT_IDS.aPickedUpV2, EVENT_IDS.aV1Only],
        foreignOrderIds: [PERSISTENT.bPickedUp, DELETABLE.bInWindow],
        foreignEventIds: [EVENT_IDS.bPickedUpV2],
      },
      {
        tenantId: TENANT_B,
        ownOrderIds: [PERSISTENT.bPickedUp, DELETABLE.bInWindow],
        ownEventIds: [EVENT_IDS.bPickedUpV2],
        foreignOrderIds: [PERSISTENT.aPickedUp, PERSISTENT.aV1Only, DELETABLE.aFrom],
        foreignEventIds: [EVENT_IDS.aPickedUpV2, EVENT_IDS.aV1Only],
      },
    ] as const;

    for (const testCase of cases) {
      const seen = await fixtureSql.begin(async (tx) => {
        await tx`SELECT set_config('app.tenant_id', ${testCase.tenantId}, true)`;
        const orders = await tx<{ id: string; tenant_id: string }[]>`
          SELECT id, tenant_id FROM public.v_order_timeliness_orders_v1
        `;
        const events = await tx<{ event_id: string; tenant_id: string }[]>`
          SELECT event_id, tenant_id FROM public.v_order_timeliness_pickup_events_v1
        `;
        return { orders, events };
      });

      // Die Vertragsspalte tenant_id ist der direkte Beweis: keine einzige
      // projizierte Zeile gehoert einem anderen Tenant.
      const foreignTenantsInOrders = [...new Set(seen.orders.map((row) => row.tenant_id))]
        .filter((tenantId) => tenantId !== testCase.tenantId);
      const foreignTenantsInEvents = [...new Set(seen.events.map((row) => row.tenant_id))]
        .filter((tenantId) => tenantId !== testCase.tenantId);
      expect({ tenantId: testCase.tenantId, foreignTenantsInOrders, foreignTenantsInEvents })
        .toEqual({
          tenantId: testCase.tenantId,
          foreignTenantsInOrders: [],
          foreignTenantsInEvents: [],
        });

      const orderIds = seen.orders.map((row) => row.id);
      const eventIds = seen.events.map((row) => row.event_id);
      // Gegenprobe gegen einen leeren Beweis: die eigenen Zeilen sind wirklich da.
      expect({
        tenantId: testCase.tenantId,
        missingOwnOrders: testCase.ownOrderIds.filter((id) => !orderIds.includes(id)),
        missingOwnEvents: testCase.ownEventIds.filter((id) => !eventIds.includes(id)),
        visibleForeignOrders: testCase.foreignOrderIds.filter((id) => orderIds.includes(id)),
        visibleForeignEvents: testCase.foreignEventIds.filter((id) => eventIds.includes(id)),
      }).toEqual({
        tenantId: testCase.tenantId,
        missingOwnOrders: [],
        missingOwnEvents: [],
        visibleForeignOrders: [],
        visibleForeignEvents: [],
      });
    }
  });
});

describe("getOrderTimelinessFacts Storno bleibt ungebaut (Q-G04-002)", () => {
  it("zeigt cancellationClass fuer keinen Fakt und keinen Tenant als storniert", async () => {
    // _MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md Z.98: Storno-Felder
    // und Storno-Ereignis bleiben bis Q-G04-002 ungebaut. Der Typ
    // OrderCancellationClass ist `never`, ein Wert ist also nicht konstruierbar;
    // dieser Test belegt dieselbe Aussage auf echten Daten und fuer JEDEN Fakt,
    // nicht nur fuer den einen Auftrag der Isolationspruefung.
    for (const [tenantId, range] of [
      [TENANT_A, RANGE],
      [TENANT_A, INNER_RANGE],
      [TENANT_B, RANGE],
    ] as const) {
      const facts = await readFacts(tenantId, range);
      expect({ tenantId, from: range.from, empty: facts.facts.length === 0 })
        .toEqual({ tenantId, from: range.from, empty: false });
      for (const fact of facts.facts) {
        expect({ orderId: fact.orderId, cancellationClass: fact.cancellationClass }).toEqual({
          orderId: fact.orderId,
          cancellationClass: {
            value: null,
            source: null,
            provenance: null,
            missingReason: "Q-G04-002 In Klaerung",
          },
        });
      }
    }
  });
});

describe("getOrderTimelinessFacts Bereichsgrenzen", () => {
  it("schliesst beide Fenstergrenzen ein und jeden Tag davor und danach aus", async () => {
    const facts = await readFacts(TENANT_A, RANGE);
    const orderIds = facts.facts.map((fact) => fact.orderId);

    // Exakt `from` und exakt `to` sind drin, ebenso ein spaeter Zeitpunkt des
    // `to`-Tages (der Port filtert `< to + 1 Tag`).
    expect(orderIds).toContain(DELETABLE.aFrom);
    expect(orderIds).toContain(DELETABLE.aTo);
    expect(orderIds).toContain(DELETABLE.aToEnd);
    // Ein Tag vor `from` und ein Tag nach `to` sind draussen.
    expect(orderIds).not.toContain(DELETABLE.aBefore);
    expect(orderIds).not.toContain(DELETABLE.aAfter);

    const promisedDates = new Map(
      facts.facts.map((fact) => [fact.orderId, fact.promisedDate.value]),
    );
    expect(promisedDates.get(DELETABLE.aFrom)).toBe(RANGE.from);
    expect(promisedDates.get(DELETABLE.aTo)).toBe(RANGE.to);
    expect(promisedDates.get(DELETABLE.aToEnd)).toBe(RANGE.to);
    expect(facts.range).toEqual(RANGE);
  });

  it("verschiebt die Grenze mit dem Fenster, nicht mit der Fixture", async () => {
    const facts = await readFacts(TENANT_A, INNER_RANGE);
    const orderIds = facts.facts.map((fact) => fact.orderId);

    expect(orderIds).not.toContain(DELETABLE.aFrom);
    expect(orderIds).not.toContain(DELETABLE.aTo);
    expect(orderIds).not.toContain(DELETABLE.aToEnd);
    expect(orderIds).toContain(PERSISTENT.aPickedUp);
    expect(orderIds).toContain(PERSISTENT.aV1Only);
    expect(facts.range).toEqual(INNER_RANGE);
  });

  it("filtert in der View selbst nicht nach Datum — die Fenstergrenze liegt allein im Port", async () => {
    // Gegenprobe zu den beiden Tests darueber, und der eigentliche Grund, warum
    // sie etwas beweisen. public.v_order_timeliness_orders_v1 traegt laut
    // supabase/migrations/20260927120000_b2_order_timeliness_read_contract.sql
    // NUR einen Tenant-Zeilenfilter und KEINEN Datumsfilter; das Fenster
    // (due_date >= from::date AND due_date < to::date + 1) steht ausschliesslich
    // in src/modules/orders/server/getOrderTimelinessFacts.ts.
    //
    // Ohne diesen Test waere der Ausschluss von aBefore/aAfter mehrdeutig: er
    // koennte ebenso gut daher kommen, dass die View die Zeilen nie liefert.
    // Hier wird deshalb dieselbe Grenze zweimal gemessen — einmal ungefiltert
    // auf der View (beide Randzeilen MUESSEN da sein) und einmal ueber den Port
    // (beide Randzeilen MUESSEN weg sein). Wandert der Datumsfilter je in die
    // View, wird genau dieser Test rot, waehrend die Port-Tests gruen blieben.
    const rows = await fixtureSql.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      return tx<{ id: string; promised_day: string }[]>`
        SELECT contract.id, to_char(contract.due_date, 'YYYY-MM-DD') AS promised_day
        FROM public.v_order_timeliness_orders_v1 contract
      `;
    });
    const promisedDayById = new Map(rows.map((row) => [row.id, row.promised_day]));

    // Bewusst ohne Zeilenzahl-Erwartung: die Datenbank traegt Append-only-Reste
    // aus fruheren Laeufen. Geprueft wird die Anwesenheit der Randzeilen mit dem
    // exakten Tag, den die Fixture geschrieben hat.
    expect({
      aBefore: promisedDayById.get(DELETABLE.aBefore) ?? null,
      aFrom: promisedDayById.get(DELETABLE.aFrom) ?? null,
      aTo: promisedDayById.get(DELETABLE.aTo) ?? null,
      aToEnd: promisedDayById.get(DELETABLE.aToEnd) ?? null,
      aAfter: promisedDayById.get(DELETABLE.aAfter) ?? null,
    }).toEqual({
      aBefore: DAY_BEFORE_FROM,
      aFrom: RANGE.from,
      aTo: RANGE.to,
      aToEnd: RANGE.to,
      aAfter: DAY_AFTER_TO,
    });

    // Dieselben beiden Randzeilen, gelesen ueber den Port: jetzt ausgeschlossen.
    const facts = await readFacts(TENANT_A, RANGE);
    const orderIds = facts.facts.map((fact) => fact.orderId);
    expect({
      aBeforeInView: promisedDayById.has(DELETABLE.aBefore),
      aBeforeInPort: orderIds.includes(DELETABLE.aBefore),
      aAfterInView: promisedDayById.has(DELETABLE.aAfter),
      aAfterInPort: orderIds.includes(DELETABLE.aAfter),
      aToEndInView: promisedDayById.has(DELETABLE.aToEnd),
      aToEndInPort: orderIds.includes(DELETABLE.aToEnd),
    }).toEqual({
      aBeforeInView: true,
      aBeforeInPort: false,
      aAfterInView: true,
      aAfterInPort: false,
      // Der spaete Zeitpunkt des to-Tages belegt die obere Grenze als `< to + 1`
      // und nicht als `<= to`: View und Port zeigen ihn beide.
      aToEndInView: true,
      aToEndInPort: true,
    });
  });
});

describe("getOrderTimelinessFacts reales public.v_*-Mapping", () => {
  it("projiziert genau den deklarierten Spaltensatz ohne payload und ohne Finanzfelder", async () => {
    for (const [view, expected] of [
      [ORDERS_VIEW, ORDERS_VIEW_COLUMNS],
      [PICKUP_EVENTS_VIEW, PICKUP_EVENTS_VIEW_COLUMNS],
    ] as const) {
      const columns = await fixtureSql<{ column_name: string; data_type: string }[]>`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${view}
        ORDER BY column_name
      `;
      expect({ view, names: columns.map((column) => column.column_name) })
        .toEqual({ view, names: [...expected] });
      // Kein rohes jsonb verlaesst den Vertrag.
      expect({ view, jsonb: columns.filter((column) => column.data_type === "jsonb") })
        .toEqual({ view, jsonb: [] });
      for (const column of columns) {
        expect({ view, forbidden: FORBIDDEN_VIEW_COLUMNS.includes(column.column_name.toLowerCase()) })
          .toEqual({ view, forbidden: false });
      }
    }

    // Gegenprobe gegen einen leeren Beweis: die Finanzfelder liegen wirklich im
    // rohen V1-Payload und werden von der View aktiv weggelassen.
    const [raw] = await fixtureSql<{ has_payment_status: boolean; has_open_amount: boolean }[]>`
      SELECT
        payload ? 'paymentStatus' AS has_payment_status,
        payload ? 'openAmountCents' AS has_open_amount
      FROM public.events
      WHERE id = ${EVENT_IDS.aV1Only}
    `;
    expect(raw).toEqual({ has_payment_status: true, has_open_amount: true });
  });

  it("laesst kein Zahlungs- oder Rechnungsfeld durch den Port an M02 austreten", async () => {
    // Der Spaltentest darueber deckt die View ab, projiziert aber bewusst die drei
    // payload_*-Gatterfelder. Dieser Test schliesst die Kette dort, wo sie das
    // Modul verlaesst: das Read-DTO. Geprueft werden Schluessel UND Werte in
    // beliebiger Tiefe, fuer beide Tenants.
    for (const [tenantId, range] of [[TENANT_A, RANGE], [TENANT_B, RANGE]] as const) {
      const facts = await readFacts(tenantId, range);
      const keys: string[] = [];
      const strings: string[] = [];
      collectKeysAndStrings(facts, keys, strings);

      expect({ tenantId, forbiddenKeys: [...new Set(keys)].filter((key) => FORBIDDEN_FACT_KEY_PATTERN.test(key)) })
        .toEqual({ tenantId, forbiddenKeys: [] });

      const leakedValues = [...new Set(strings)].filter((value) =>
        FORBIDDEN_FACT_VALUES.some((forbidden) => value.toLowerCase().includes(forbidden)));
      expect({ tenantId, leakedValues }).toEqual({ tenantId, leakedValues: [] });

      // Gegenprobe gegen einen leeren Beweis: der Scan hat wirklich etwas gesehen.
      expect({ tenantId, sawKeys: keys.includes("pickedUpAt"), sawStrings: strings.length > 0 })
        .toEqual({ tenantId, sawKeys: true, sawStrings: true });
    }
  });

  it("stimmt jeden Port-Wert mit einem direkten Read derselben Views ab", async () => {
    const direct = await fixtureSql.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      const orders = await tx<{
        id: string;
        order_number: string;
        status: string;
        version: number;
        promised_day: string;
        completed_at: string | null;
      }[]>`
        SELECT
          contract.id,
          contract.order_number,
          contract.status,
          contract.version,
          to_char(contract.due_date, 'YYYY-MM-DD') AS promised_day,
          to_char(contract.completed_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            AS completed_at
        FROM public.v_order_timeliness_orders_v1 contract
        WHERE contract.due_date >= (${RANGE.from})::date
          AND contract.due_date < ((${RANGE.to})::date + 1)
      `;
      const events = await tx<{
        event_id: string;
        order_id: string;
        aggregate_version: number;
        event_schema_version: number;
        occurred_at: string;
      }[]>`
        SELECT
          contract.event_id,
          contract.order_id,
          contract.aggregate_version,
          contract.event_schema_version,
          to_char(contract.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at
        FROM public.v_order_timeliness_pickup_events_v1 contract
        WHERE contract.event_type = 'ORDER_PICKED_UP_V2'
      `;
      return { orders, events };
    });

    const facts = await readFacts(TENANT_A, RANGE);

    // Gleiche Zeilenmenge: der Port erfindet keine Zeile und verliert keine.
    expect(facts.facts.map((fact) => fact.orderId).sort())
      .toEqual(direct.orders.map((row) => row.id).sort());
    expect(direct.orders.length).toBeGreaterThanOrEqual(5);

    const eventByOrder = new Map(direct.events.map((row) => [row.order_id, row]));
    for (const fact of facts.facts) {
      const row = direct.orders.find((candidate) => candidate.id === fact.orderId);
      expect(row).toBeDefined();
      if (!row) continue;
      expect({
        orderNumber: fact.orderNumber,
        lifecycleStatus: fact.lifecycleStatus,
        orderVersion: fact.orderVersion,
        promisedDate: fact.promisedDate.value,
        finishedAt: fact.finishedAt.value,
      }).toEqual({
        orderNumber: row.order_number,
        lifecycleStatus: row.status,
        orderVersion: row.version,
        promisedDate: row.promised_day,
        finishedAt: row.completed_at,
      });

      const event = eventByOrder.get(fact.orderId);
      if (!event) {
        expect(fact.pickedUpAt.value).toBeNull();
        continue;
      }
      expect(fact.pickedUpAt).toEqual({
        value: event.occurred_at,
        source: "events.ORDER_PICKED_UP_V2.created_at",
        provenance: {
          kind: "event",
          relation: "public.events",
          eventId: event.event_id,
          eventType: "ORDER_PICKED_UP_V2",
          eventSchemaVersion: event.event_schema_version,
          aggregateVersion: event.aggregate_version,
        },
        missingReason: null,
      });
    }
  });
});
