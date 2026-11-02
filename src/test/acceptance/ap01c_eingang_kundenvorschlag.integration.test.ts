// @vitest-environment node
// AP-01 Fassung 4.2: echte Namenserkennung ueber die kanonische Kundensuche gegen die Replay-DB.

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";
import { findRecognizedCustomers } from "@/modules/eingang/public";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("AP01C_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("AP01C_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("AP01C_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "ap01c-kundenvorschlag-local-only";

type Fixture = { actorId: string; actorIssuedAt: number };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/ap01c-kundenvorschlag", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/ap01c-kundenvorschlag",
    route: "/ap01c-kundenvorschlag",
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
    { pathname: "/ap01c-kundenvorschlag", search: "" },
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
    displayName: "AP01C Kundenvorschlag",
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
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`ap01c-${actorId}@local.invalid`},
        'AP01C Kundenvorschlag', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${["eingang", "auftraege", "kunden"]}::text[]) area
    `;
  });
  return { actorId, actorIssuedAt: Date.now() };
}

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("AP-01 Fassung 4.2: Kundenname aus Schnell erfassen", () => {
  it("legt Sabrina Schmidt an und liefert sie aus echtem Erkennen plus echter Serversuche als Vorschlag", async () => {
    const fixture = await createFixture();
    const clientEventId = randomUUID();
    const { createCustomerAction } = await import("@/app/actions/customers.actions");
    const created = await withSession(fixture, () => createCustomerAction({
      city: "Stuttgart",
      clientEventId,
      companyName: null,
      contactPerson: null,
      customerType: "privat",
      email: `ap01c-${clientEventId}@example.invalid`,
      name: "Sabrina Schmidt",
      notes: "AP01C Namenserkennung",
      paymentPreference: "vorkasse",
      phone: `+49 711 ${clientEventId.replace(/\D/g, "").slice(0, 7).padEnd(7, "4")}`,
      street: "Vorschlagsweg 42",
      zipCode: "70176",
      country: "Deutschland",
      vatId: null,
    }));
    expect(created.code).toBe("OK");
    if (created.code !== "OK") throw new Error(`AP01C_CUSTOMER_CREATE_FAILED:${created.code}:${created.message}`);

    const [databaseRow] = await sql<{ id: string; event_type: string }[]>`
      SELECT customer.id::text, event.event_type
      FROM public.customers customer
      JOIN public.events event ON event.tenant_id=customer.tenant_id
        AND event.client_event_id=${clientEventId}::uuid
      WHERE customer.tenant_id=${KREILE_TENANT_SLUG} AND customer.id=${created.receipt.customerId}
    `;
    expect(databaseRow).toEqual({ id: created.receipt.customerId, event_type: "CUSTOMER_CREATED_V1" });

    const text = "sabrina schmidt";
    const { recognizeOrderIntakeTextAction, searchOrderIntakeCustomersAction } = await import("@/app/warendurchlauf/actions");
    const recognition = await withSession(fixture, () => recognizeOrderIntakeTextAction({ text }));
    expect(recognition.ok).toBe(true);

    const suggestions = await findRecognizedCustomers(text, async (query) => {
      const result = await withSession(fixture, () => searchOrderIntakeCustomersAction({ query }));
      if (!result.ok) {
        return {
          code: result.error === "FORBIDDEN" || result.error === "AUTH_ERROR" ? "DENIED" as const : "UNAVAILABLE" as const,
          message: result.message,
        };
      }
      return { code: "OK" as const, customers: result.data.customers };
    });

    expect(suggestions.code).toBe("OK");
    if (suggestions.code !== "OK") throw new Error(`AP01C_SUGGESTION_FAILED:${suggestions.code}:${suggestions.message}`);
    expect(suggestions.query.toLocaleLowerCase("de-DE")).toBe("sabrina schmidt");
    expect(suggestions.customers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.receipt.customerId, name: "Sabrina Schmidt" }),
    ]));
    expect(suggestions.customers.length).toBeGreaterThanOrEqual(1);
    expect(suggestions.customers.length).toBeLessThanOrEqual(3);
  });
});
