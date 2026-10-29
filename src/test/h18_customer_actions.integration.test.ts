// @vitest-environment node

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
  throw new Error("H18_CUSTOMER_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_CUSTOMER_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_CUSTOMER_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-customer-actions-local-only";

type Fixture = { actorId: string; actorIssuedAt: number };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-customer-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-customer-actions",
    route: "/h18-customer-actions",
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
    { pathname: "/h18-customer-actions", search: "" },
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
    displayName: "Rolf H18 Kunde",
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
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-customer-${actorId}@local.invalid`},
        'Rolf H18 Kunde', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(ARRAY['auftraege', 'kunden', 'geld']::text[]) area
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_CUSTOMER_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt };
}

beforeAll(async () => {
  const migrations = await sql<{ version: string }[]>`
    SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version
  `;
  const repositoryMigrations = readdirSync(join(process.cwd(), "supabase", "migrations"))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => file.slice(0, file.indexOf("_")))
    .sort();
  expect(migrations.map((row) => row.version)).toEqual(repositoryMigrations);
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("H18 customer Server Actions against the real replay database", () => {
  it("creates and edits the customer through UI actions with DB, event and view readback", async () => {
    const fixture = await createFixture();
    const createClientEventId = randomUUID();
    const updateClientEventId = randomUUID();
    const noteClientEventId = randomUUID();
    const {
      createCustomerAction,
      getCustomerSummaryAction,
      updateCustomerCommercialAction,
      updateCustomerNoteAction,
    } = await import("@/app/actions/customers.actions");

    const created = await withSession(fixture, () => createCustomerAction({
      city: "Stuttgart",
      clientEventId: createClientEventId,
      companyName: "H18 Kundenanlage GmbH",
      contactPerson: "Ada Kundin",
      customerType: "business",
      email: "h18-kundenanlage@example.invalid",
      name: "H18 Kundenanlage",
      notes: "H18 Erstnotiz",
      paymentPreference: "vorkasse",
      phone: "+49 711 5550190",
      street: "Kundenweg 18",
      zipCode: "70176",
      country: "Deutschland",
      vatId: "DE123456789",
    }));
    expect(created.code).toBe("OK");
    if (created.code !== "OK") throw new Error(`H18_CUSTOMER_CREATE_FAILED:${created.code}:${created.message}`);
    const [createdRow] = await sql<{
      id: string;
      name: string;
      payment_preference: string;
      event_type: string;
      actor_id: string;
    }[]>`
      SELECT customer.id, customer.name, customer.payment_preference,
        event.event_type, event.user_id::text AS actor_id
      FROM public.customers customer
      JOIN public.events event ON event.tenant_id=customer.tenant_id
        AND event.client_event_id=${createClientEventId}::uuid
      WHERE customer.id=${created.receipt.customerId} AND customer.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(createdRow).toEqual({
      id: created.receipt.customerId,
      name: "H18 Kundenanlage",
      payment_preference: "vorkasse",
      event_type: "CUSTOMER_CREATED_V1",
      actor_id: fixture.actorId,
    });
    const createdView = await withSession(fixture, () => getCustomerSummaryAction({ customerId: created.receipt.customerId }));
    expect(createdView).toMatchObject({
      code: "OK",
      data: { id: created.receipt.customerId, name: "H18 Kundenanlage", paymentPreference: "vorkasse" },
    });

    const updated = await withSession(fixture, () => updateCustomerCommercialAction({
      clientEventId: updateClientEventId,
      customerId: created.receipt.customerId,
      name: "H18 Kunde bearbeitet",
      companyName: "H18 Kunde bearbeitet GmbH",
      contactPerson: "Ada Bearbeitet",
      email: "h18-bearbeitet@example.invalid",
      phone: "+49 711 5550191",
      street: "Bearbeitungsweg 19",
      zipCode: "70177",
      city: "Stuttgart",
      country: "Deutschland",
      paymentPreference: "bar",
      vatId: "DE987654321",
    }));
    expect(updated.code).toBe("OK");
    if (updated.code !== "OK") throw new Error(`H18_CUSTOMER_UPDATE_FAILED:${updated.code}:${updated.message}`);
    const [updatedRow] = await sql<{
      name: string;
      contact_person: string;
      payment_preference: string;
      event_type: string;
    }[]>`
      SELECT customer.name, customer.contact_person, customer.payment_preference, event.event_type
      FROM public.customers customer
      JOIN public.events event ON event.tenant_id=customer.tenant_id
        AND event.client_event_id=${updateClientEventId}::uuid
      WHERE customer.id=${created.receipt.customerId} AND customer.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(updatedRow).toEqual({
      name: "H18 Kunde bearbeitet",
      contact_person: "Ada Bearbeitet",
      payment_preference: "bar",
      event_type: "CUSTOMER_COMMERCIAL_UPDATED_V1",
    });
    const updatedView = await withSession(fixture, () => getCustomerSummaryAction({ customerId: created.receipt.customerId }));
    expect(updatedView).toMatchObject({
      code: "OK",
      data: { name: "H18 Kunde bearbeitet", contactPerson: "Ada Bearbeitet", paymentPreference: "bar" },
    });

    const note = await withSession(fixture, () => updateCustomerNoteAction({
      clientEventId: noteClientEventId,
      customerId: created.receipt.customerId,
      note: "H18 Notiz bearbeitet",
    }));
    expect(note.code).toBe("OK");
    if (note.code !== "OK") throw new Error(`H18_CUSTOMER_NOTE_FAILED:${note.code}:${note.message}`);
    const [noteRow] = await sql<{ internal_notes: string; event_type: string }[]>`
      SELECT customer.internal_notes, event.event_type
      FROM public.customers customer
      JOIN public.events event ON event.tenant_id=customer.tenant_id
        AND event.client_event_id=${noteClientEventId}::uuid
      WHERE customer.id=${created.receipt.customerId} AND customer.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(noteRow).toEqual({ internal_notes: "H18 Notiz bearbeitet", event_type: "CUSTOMER_NOTE_CHANGED_V1" });
    const noteView = await withSession(fixture, () => getCustomerSummaryAction({ customerId: created.receipt.customerId }));
    expect(noteView).toMatchObject({ code: "OK", data: { internalNotes: "H18 Notiz bearbeitet" } });
  });
});
