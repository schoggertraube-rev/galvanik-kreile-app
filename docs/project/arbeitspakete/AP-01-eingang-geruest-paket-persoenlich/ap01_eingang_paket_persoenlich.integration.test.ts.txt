// @vitest-environment node
// AP-01 Akzeptanztest - Kanal "Paket/persoenlich" (getippt -> Auftrag), eine Wahrheit.
// Planungschat-Vertrag (U-221). Codex kopiert diese Datei bytegleich nach
// src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts und aendert sie nie.
// Harness wie die H18-Tests: echte signierte Sitzung, echte Server-Action, lokale Replay-DB.
// Dieser Test ist zugleich der H18-Nachweis fuer erfasseAuftragAusEingangAction.

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
  throw new Error("AP01_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("AP01_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("AP01_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "ap01-eingang-local-only";
const RUN = randomUUID().slice(0, 8);

type Fixture = { actorId: string; actorIssuedAt: number };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/ap01-eingang", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/ap01-eingang",
    route: "/ap01-eingang",
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
    { pathname: "/ap01-eingang", search: "" },
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
    displayName: "AP01 Eingang",
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
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`ap01-eingang-${actorId}@local.invalid`},
        'AP01 Eingang', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
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
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("AP01_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt };
}

let customerId = "";
let eingangActor: Fixture;
let ohneEingangActor: Fixture;

beforeAll(async () => {
  const migrations = await sql<{ version: string }[]>`
    SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version
  `;
  const repositoryMigrations = readdirSync(join(process.cwd(), "supabase", "migrations"))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => file.slice(0, file.indexOf("_")))
    .sort();
  expect(migrations.map((row) => row.version)).toEqual(repositoryMigrations);

  eingangActor = await createFixture(["eingang", "auftraege", "kunden"]);
  ohneEingangActor = await createFixture(["auftraege", "kunden"]);

  // Bestandskunde ueber den kanonischen, H18-belegten Weg (keine zweite Kundenanlage im Test).
  const { createCustomerAction } = await import("@/app/actions/customers.actions");
  const created = await withSession(eingangActor, () => createCustomerAction({
    city: "Stuttgart",
    clientEventId: randomUUID(),
    companyName: `AP01 Bestandskunde ${RUN} GmbH`,
    contactPerson: "Ada Bestand",
    customerType: "business",
    email: `ap01-bestand-${RUN}@example.invalid`,
    name: `AP01 Bestandskunde ${RUN}`,
    notes: "AP01 Seed",
    paymentPreference: "vorkasse",
    phone: "+49 711 5550101",
    street: "Eingangsweg 1",
    zipCode: "70176",
    country: "Deutschland",
    vatId: "DE123456789",
  }));
  if (created.code !== "OK") throw new Error(`AP01_CUSTOMER_SEED_FAILED:${created.code}:${created.message}`);
  customerId = created.receipt.customerId;
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

function auftragInput(clientKey: string) {
  return {
    clientKey,
    text: "2 Stueck Flansch verzinken, bis naechste Woche",
    customer: { mode: "EXISTING" as const, customerId },
    dueDate: "2027-04-30",
    handoverMode: "pickup" as const,
    paymentMode: "vorkasse" as const,
    items: [{
      catalogServiceId: null,
      name: "AP01 Flansch",
      quantity: 2,
      material: "Stahl",
      surfaceRequested: "Verzinken",
      executionRequested: "offen" as const,
      unit: null,
      unitPriceCents: null,
      vatRateBasisPoints: null,
    }],
  };
}

describe("AP-01 Kanal Paket/persoenlich: getippt -> Auftrag (Bestandskunde), echte Server-Action", () => {
  it("legt EIN intake_item, EINEN Auftrag ueber createOrderIntake und intake_event an", async () => {
    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const clientKey = randomUUID();
    const result = await withSession(eingangActor, () => erfasseAuftragAusEingangAction(auftragInput(clientKey)));
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error(`AP01_CREATE_FAILED:${result.code}:${result.message}`);
    expect(result.orderNumber).toMatch(/^A-\d{4}-\d{4,}$/);
    expect(result.replayed).toBe(false);

    const items = await sql<{
      id: string; kanal: string; richtung: string; quelle: string; kunde_id: string;
      vorgang_art: string; vorgang_id: string; zuordnung: string; erstellt_von: string;
    }[]>`
      SELECT id::text, kanal, richtung, quelle, kunde_id, vorgang_art, vorgang_id, zuordnung, erstellt_von::text
      FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${clientKey}
    `;
    expect(items).toEqual([{
      id: result.intakeItemId, kanal: "notiz", richtung: "rein", quelle: "geraet", kunde_id: customerId,
      vorgang_art: "auftrag", vorgang_id: result.orderNumber, zuordnung: "hand", erstellt_von: eingangActor.actorId,
    }]);

    const orders = await sql<{ id: string }[]>`
      SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_number=${result.orderNumber}
    `;
    expect(orders).toEqual([{ id: result.orderId }]);

    const receipts = await sql<{ order_number: string }[]>`
      SELECT order_number FROM private.order_intake_receipts
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid
    `;
    expect(receipts).toEqual([{ order_number: result.orderNumber }]);

    const created = await sql<{ status: string; user_id: string }[]>`
      SELECT status, user_id::text FROM public.events
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid
        AND event_type='ORDER_INTAKE_CREATED_V1'
    `;
    expect(created).toEqual([{ status: "success", user_id: eingangActor.actorId }]);

    const verlauf = await sql<{ art: string }[]>`
      SELECT art FROM public.intake_event
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${result.intakeItemId}::uuid ORDER BY zeit, art
    `;
    const arten = verlauf.map((row) => row.art);
    expect(arten).toContain("angelegt");
    expect(arten).toContain("zugeordnet");
  });

  it("ist idempotent ueber clientKey: gleicher Auftrag, keine zweite Zeile", async () => {
    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const clientKey = randomUUID();
    const first = await withSession(eingangActor, () => erfasseAuftragAusEingangAction(auftragInput(clientKey)));
    if (first.code !== "OK") throw new Error(`AP01_FIRST_FAILED:${first.code}:${first.message}`);
    expect(first.replayed).toBe(false);
    const second = await withSession(eingangActor, () => erfasseAuftragAusEingangAction(auftragInput(clientKey)));
    if (second.code !== "OK") throw new Error(`AP01_SECOND_FAILED:${second.code}:${second.message}`);
    expect(second.replayed).toBe(true);
    expect(second.orderNumber).toBe(first.orderNumber);
    expect(second.intakeItemId).toBe(first.intakeItemId);

    const [counts] = await sql<{ items: number; receipts: number; created: number }[]>`
      SELECT
        (SELECT count(*)::int FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${clientKey}) AS items,
        (SELECT count(*)::int FROM private.order_intake_receipts WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid) AS receipts,
        (SELECT count(*)::int FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid
           AND event_type='ORDER_INTAKE_CREATED_V1') AS created
    `;
    expect(counts).toEqual({ items: 1, receipts: 1, created: 1 });
  });

  it("verweigert ohne Recht 'eingang' und schreibt nichts", async () => {
    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const clientKey = randomUUID();
    const result = await withSession(ohneEingangActor, () => erfasseAuftragAusEingangAction(auftragInput(clientKey)));
    expect(result.code).toBe("FORBIDDEN");

    const [counts] = await sql<{ items: number; receipts: number }[]>`
      SELECT
        (SELECT count(*)::int FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${clientKey}) AS items,
        (SELECT count(*)::int FROM private.order_intake_receipts WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid) AS receipts
    `;
    expect(counts).toEqual({ items: 0, receipts: 0 });
  });
});
