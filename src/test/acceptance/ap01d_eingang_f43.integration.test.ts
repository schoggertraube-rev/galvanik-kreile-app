// @vitest-environment node
// AP-01 Fassung 4.3: order-first, payment contract and private-customer booking against the replay DB.

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("AP01D_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("AP01D_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("AP01D_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "ap01d-f43-local-only";

type Fixture = { actorId: string; actorIssuedAt: number };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/ap01d-f43", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/ap01d-f43",
    route: "/ap01d-f43",
    afterContext: {},
    previouslyRevalidatedTags: [],
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    deploymentId: "test",
    buildId: "test",
    incrementalCache: {},
    cacheComponentsEnabled: false,
    runInCleanSnapshot: (fn: (...args: never[]) => unknown, ...args: never[]) => fn(...args),
    reactServerErrorsByDigest: new Map(),
  } as unknown as import("next/dist/server/app-render/work-async-storage.external").WorkStore;
  const requestStore = createRequestStoreForAPI(
    request,
    { pathname: "/ap01d-f43", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));
}

async function withSession<T>(fixture: Fixture, work: () => Promise<T>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId: fixture.actorId,
    tenantId: KREILE_TENANT_SLUG,
    role: "meister",
    displayName: "AP01D F43",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(): Promise<Fixture> {
  const actorId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`ap01d-${actorId}@local.invalid`},
        'AP01D F43', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${["eingang", "auftraege", "kunden", "geld"]}::text[]) area
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("AP01D_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt };
}

let actor: Fixture;
let privateCustomerId = "";

beforeAll(async () => {
  actor = await createFixture();
  const clientEventId = randomUUID();
  const { createCustomerAction } = await import("@/app/actions/customers.actions");
  const created = await withSession(actor, () => createCustomerAction({
    city: "Bern",
    clientEventId,
    companyName: null,
    contactPerson: null,
    customerType: "privat",
    email: `ap01d-${clientEventId}@example.invalid`,
    name: "AP01D Gregor Privat",
    notes: "AP01D F43",
    paymentPreference: "vorkasse",
    phone: "+41 77 402 33 08",
    street: "Wyttenbachstrasse 27",
    zipCode: "3013",
    country: "Schweiz",
    vatId: null,
  }));
  if (created.code !== "OK") throw new Error(`AP01D_CUSTOMER_SEED_FAILED:${created.code}:${created.message}`);
  privateCustomerId = created.receipt.customerId;
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

function input(clientKey: string, overrides: Record<string, unknown> = {}) {
  return {
    clientKey,
    text: "AP01D F43 Paket",
    customer: { mode: "EXISTING" as const, customerId: privateCustomerId },
    dueDate: "2027-07-15",
    termStatus: "bestaetigt" as const,
    intakeSource: "persoenlich" as const,
    handoverMode: "pickup" as const,
    paymentMode: "abholung" as const,
    items: [{
      catalogServiceId: null,
      name: "AP01D Halter",
      quantity: 1,
      material: "Stahl",
      surfaceRequested: "Vernickeln",
      executionRequested: "offen" as const,
      unit: null,
      unitPriceCents: null,
      vatRateBasisPoints: null,
    }],
    ...overrides,
  };
}

async function counts(clientKey: string) {
  const [row] = await sql<{ intakes: number; receipts: number; events: number }[]>`
    SELECT
      (SELECT count(*)::int FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${clientKey}) AS intakes,
      (SELECT count(*)::int FROM private.order_intake_receipts WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid) AS receipts,
      (SELECT count(*)::int FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid AND event_type='ORDER_INTAKE_CREATED_V1') AS events
  `;
  return row;
}

describe("AP-01 Fassung 4.3: echte Server-Action gegen Replay-DB", () => {
  it("bucht einen Privatkunden ohne Ansprechpartner mit erlaubter Abholzahlung und verknüpft den Eingang", async () => {
    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const clientKey = randomUUID();
    const result = await withSession(actor, () => erfasseAuftragAusEingangAction(input(clientKey)));
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error(`AP01D_PRIVATE_CREATE_FAILED:${result.code}:${result.message}`);

    const [linked] = await sql<{ order_number: string; payment_mode: string; handover_mode: string; vorgang_id: string }[]>`
      SELECT orders.order_number, orders.payment_mode, orders.handover_mode, intake.vorgang_id
      FROM public.orders orders
      JOIN public.intake_item intake ON intake.tenant_id=orders.tenant_id AND intake.vorgang_id=orders.order_number
      WHERE orders.tenant_id=${KREILE_TENANT_SLUG} AND orders.id=${result.orderId}
    `;
    expect(linked).toEqual({
      order_number: result.orderNumber,
      payment_mode: "abholung",
      handover_mode: "pickup",
      vorgang_id: result.orderNumber,
    });
    expect(await counts(clientKey)).toEqual({ intakes: 1, receipts: 1, events: 1 });
  });

  it("legt bei einem Auftragsfehler keinen Eingang an und holt beim Retry mit demselben clientKey alle Schritte nach", async () => {
    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const clientKey = randomUUID();
    const invalidCatalogItem = [{
      catalogServiceId: randomUUID(),
      name: "AP01D Ungültiger Katalogstand",
      quantity: 1,
      material: null,
      surfaceRequested: "Vernickeln",
      executionRequested: "offen" as const,
      unit: "Stück",
      unitPriceCents: null,
      vatRateBasisPoints: 1900 as const,
    }];
    const failed = await withSession(actor, () => erfasseAuftragAusEingangAction(input(clientKey, { items: invalidCatalogItem })));
    expect(failed).toEqual({ code: "VALIDATION_ERROR", message: "Wareneingangsdaten sind unvollständig oder ungültig." });
    expect(await counts(clientKey)).toEqual({ intakes: 0, receipts: 0, events: 0 });

    const retried = await withSession(actor, () => erfasseAuftragAusEingangAction(input(clientKey)));
    expect(retried.code).toBe("OK");
    if (retried.code !== "OK") throw new Error(`AP01D_RETRY_FAILED:${retried.code}:${retried.message}`);
    expect(await counts(clientKey)).toEqual({ intakes: 1, receipts: 1, events: 1 });
  });

  it("weist einen unzulässigen Zahlungsmodus vor jedem Eingang zurück und erlaubt die korrigierte Wiederholung", async () => {
    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const clientKey = randomUUID();
    const failed = await withSession(actor, () => erfasseAuftragAusEingangAction(input(clientKey, {
      handoverMode: "shipping",
      paymentMode: "abholung",
    })));
    expect(failed).toEqual({ code: "VALIDATION_ERROR", message: "Bar oder Karte nur bei Abholung." });
    expect(await counts(clientKey)).toEqual({ intakes: 0, receipts: 0, events: 0 });

    const retried = await withSession(actor, () => erfasseAuftragAusEingangAction(input(clientKey, {
      handoverMode: "shipping",
      paymentMode: "vorkasse",
    })));
    expect(retried.code).toBe("OK");
    expect(await counts(clientKey)).toEqual({ intakes: 1, receipts: 1, events: 1 });
  });
});
