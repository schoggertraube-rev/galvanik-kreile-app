// @vitest-environment node
// AP-01 Fassung 4 Akzeptanztest - Bestandskunde unvollstaendig/ungueltig: Server sperrt, kanonische Korrektur, dann Auftrag.
// Planungschat-Vertrag (U-221/U-225). Codex kopiert diese Datei bytegleich nach
// src/test/acceptance/ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts und aendert sie nie.
// Harness wie AP-01/H18. Der Altbestand "3013 Bern / Deutschland" wird nur im Fixture per SQL simuliert;
// korrigiert wird ausschliesslich ueber den kanonischen Kunden-Schreibweg updateCustomerCommercialAction.

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("AP01B_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("AP01B_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("AP01B_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "ap01b-kunde-local-only";
const RUN = randomUUID().slice(0, 8);

type Fixture = { actorId: string; actorIssuedAt: number };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/ap01b-kunde", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/ap01b-kunde",
    route: "/ap01b-kunde",
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
    { pathname: "/ap01b-kunde", search: "" },
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
    displayName: "AP01B Kunde",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(rights: string[]): Promise<Fixture> {
  const actorId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`ap01b-kunde-${actorId}@local.invalid`},
        'AP01B Kunde', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${rights}::text[]) area
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("AP01B_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt };
}

let customerId = "";
let actor: Fixture;
const SEED = {
  city: "Stuttgart",
  companyName: `AP01B Schmidt ${RUN} GmbH`,
  contactPerson: "Sabrina Schmidt",
  customerType: "business" as const,
  email: `ap01b-${RUN}@example.invalid`,
  name: `AP01B Schmidt ${RUN}`,
  notes: "AP01B Seed",
  paymentPreference: "vorkasse",
  phone: "+49 711 5550303",
  street: "Bundesgasse 3",
  zipCode: "70176",
  country: "Deutschland",
  vatId: null,
};

beforeAll(async () => {
  const migrations = await sql<{ version: string }[]>`
    SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version
  `;
  const repositoryMigrations = readdirSync(join(process.cwd(), "supabase", "migrations"))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => file.slice(0, file.indexOf("_")))
    .sort();
  expect(migrations.map((row) => row.version)).toEqual(repositoryMigrations);

  actor = await createFixture(["eingang", "auftraege", "kunden", "geld"]);
  const { createCustomerAction } = await import("@/app/actions/customers.actions");
  const created = await withSession(actor, () => createCustomerAction({ ...SEED, clientEventId: randomUUID() }));
  if (created.code !== "OK") throw new Error(`AP01B_CUSTOMER_SEED_FAILED:${created.code}:${created.message}`);
  customerId = created.receipt.customerId;
  // Altbestand simulieren: Schweizer PLZ/Ort bei Land Deutschland (Befund Owner-Klicktest 01.11., K-2026-0011).
  await sql`
    UPDATE public.customers SET zip_code='3013', city='Bern', country='Deutschland'
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}
  `;
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

function auftragInput(clientKey: string) {
  return {
    clientKey,
    text: "Bestandskunde bringt 4 Halter",
    customer: { mode: "EXISTING" as const, customerId },
    dueDate: "2027-06-11",
    handoverMode: "pickup" as const,
    paymentMode: "vorkasse" as const,
    items: [{
      catalogServiceId: null,
      name: "AP01B Halter",
      quantity: 4,
      material: "Stahl",
      surfaceRequested: "Verzinken",
      executionRequested: "offen" as const,
      unit: null,
      unitPriceCents: null,
      vatRateBasisPoints: null,
    }],
  };
}

async function kunde() {
  const [row] = await sql<{ zip_code: string | null; city: string | null; country: string | null }[]>`
    SELECT zip_code, city, country FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}
  `;
  return row;
}

async function zaehle(clientKey: string) {
  const [counts] = await sql<{ items: number; receipts: number }[]>`
    SELECT
      (SELECT count(*)::int FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${clientKey}) AS items,
      (SELECT count(*)::int FROM private.order_intake_receipts WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid) AS receipts
  `;
  return counts;
}

describe("AP-01 Fassung 4: Bestandskunde fuer den Auftrag unvollstaendig", () => {
  it("sperrt serverseitig mit CUSTOMER_INCOMPLETE, nennt die PLZ und schreibt nichts", async () => {
    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const clientKey = randomUUID();
    const result = await withSession(actor, () => erfasseAuftragAusEingangAction(auftragInput(clientKey)));
    expect(result.code).toBe("CUSTOMER_INCOMPLETE");
    if (result.code !== "CUSTOMER_INCOMPLETE") throw new Error("AP01B_EXPECTED_INCOMPLETE");
    expect(result.missing).toContain("zipCode");
    expect(await zaehle(clientKey)).toEqual({ items: 0, receipts: 0 });
    expect(await kunde()).toEqual({ zip_code: "3013", city: "Bern", country: "Deutschland" });
  });

  it("nach Korrektur ueber den kanonischen Kunden-Schreibweg entsteht genau ein Auftrag am korrigierten Kunden", async () => {
    const { updateCustomerCommercialAction } = await import("@/app/actions/customers.actions");
    const corrected = await withSession(actor, () => updateCustomerCommercialAction({
      clientEventId: randomUUID(),
      customerId,
      name: SEED.name,
      companyName: SEED.companyName,
      contactPerson: SEED.contactPerson,
      email: SEED.email,
      phone: SEED.phone,
      street: SEED.street,
      zipCode: "3013",
      city: "Bern",
      country: "Schweiz",
      paymentPreference: SEED.paymentPreference,
      vatId: null,
    }));
    expect(corrected.code).toBe("OK");
    expect(await kunde()).toEqual({ zip_code: "3013", city: "Bern", country: "Schweiz" });

    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const clientKey = randomUUID();
    const first = await withSession(actor, () => erfasseAuftragAusEingangAction(auftragInput(clientKey)));
    expect(first.code).toBe("OK");
    if (first.code !== "OK") throw new Error(`AP01B_CREATE_FAILED:${first.code}:${first.message}`);
    const second = await withSession(actor, () => erfasseAuftragAusEingangAction(auftragInput(clientKey)));
    if (second.code !== "OK") throw new Error(`AP01B_REPLAY_FAILED:${second.code}:${second.message}`);
    expect(second.replayed).toBe(true);
    expect(second.orderNumber).toBe(first.orderNumber);

    const items = await sql<{ kunde_id: string; vorgang_id: string }[]>`
      SELECT kunde_id, vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${clientKey}
    `;
    expect(items).toEqual([{ kunde_id: customerId, vorgang_id: first.orderNumber }]);
    const orders = await sql<{ customer_id: string }[]>`
      SELECT customer_id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_number=${first.orderNumber}
    `;
    expect(orders).toEqual([{ customer_id: customerId }]);
    expect(await zaehle(clientKey)).toEqual({ items: 1, receipts: 1 });
    expect(await kunde()).toEqual({ zip_code: "3013", city: "Bern", country: "Schweiz" });
  });
});
