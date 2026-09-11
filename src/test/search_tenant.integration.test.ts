// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.SEARCH_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("SEARCH_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal SEARCH_EXPECTED_DATABASE_URL");
}
const parsedDatabaseUrl = new URL(DATABASE_URL);
if (
  parsedDatabaseUrl.protocol !== "postgresql:"
  || parsedDatabaseUrl.hostname !== "127.0.0.1"
  || parsedDatabaseUrl.pathname !== "/postgres"
  || parsedDatabaseUrl.username !== "postgres"
) {
  throw new Error("SEARCH_LOCAL_DATABASE_REQUIRED: expected the dedicated local Postgres database");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SEARCH_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const suffix = `${Date.now()}-${process.pid}`;
const TEST_SESSION_SECRET = "search-contract-real-session-local-only";
const ORIGINAL_SESSION_SECRET = process.env.APP_SESSION_SECRET;
const USER_ID = randomUUID();
const DUE_DATE = "2026-11-19";
let sessionIssuedAt = 0;

process.env.APP_SESSION_SECRET = TEST_SESSION_SECRET;

async function withRequest<T>(cookie: string | null, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/search-test", {
    headers: cookie ? { cookie } : undefined,
  });
  const workStore = {
    isStaticGeneration: false,
    page: "/search-test",
    route: "/search-test",
    afterContext: {},
    previouslyRevalidatedTags: [],
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    deploymentId: "test",
    buildId: "test",
    cacheComponentsEnabled: false,
    runInCleanSnapshot: (fn: (...args: never[]) => unknown, ...args: never[]) => fn(...args),
    reactServerErrorsByDigest: new Map(),
  } as unknown as import("next/dist/server/app-render/work-async-storage.external").WorkStore;
  const requestStore = createRequestStoreForAPI(
    request,
    { pathname: "/search-test", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));
}

async function withRealSession<T>(work: () => Promise<T>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, readAppSession, signAppSession } = await import("@/lib/server/appSession");
  if (sessionIssuedAt < 1) throw new Error("SEARCH_SESSION_NOT_SEEDED");
  const session: AppSession = {
    userId: USER_ID,
    tenantId: KREILE_TENANT_SLUG,
    role: "admin",
    displayName: "Search Contract Admin",
    issuedAt: sessionIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  const cookie = `${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`;
  return withRequest(cookie, async () => {
    const readback = await readAppSession();
    if (!readback.ok) throw new Error(`SEARCH_SESSION_READBACK_FAILED:${readback.reason}`);
    expect(readback.session).toMatchObject({ userId: USER_ID, tenantId: KREILE_TENANT_SLUG, role: "admin" });
    return work();
  });
}

beforeAll(async () => {
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (
      ${USER_ID}::uuid, ${KREILE_TENANT_SLUG}, ${`search-${suffix}@local.invalid`},
      'Search Contract Admin', 'admin', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
    )
  `;
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id = ${USER_ID}::uuid
  `;
  const persisted = Number(clock?.updated_at_ms);
  sessionIssuedAt = Date.now();
  if (!Number.isSafeInteger(persisted) || persisted >= sessionIssuedAt) {
    throw new Error("SEARCH_SESSION_REVOCATION_ORDER_INVALID");
  }
});

afterAll(async () => {
  // The dedicated Fresh-Supabase database is discarded after the blocking lane.
  // Append-only command evidence is deliberately never deleted by the test.
  await sql.end({ timeout: 1 });
  if (ORIGINAL_SESSION_SECRET === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = ORIGINAL_SESSION_SECRET;
});

describe("Path-1 S5 tenant search real database contract", () => {
  it("finds one canonical order/customer through every promised field and fails closed", async () => {
    const { createOrderIntake } = await import("@/lib/server/commands/orderIntakeCommand");
    const intake = await withRealSession(() => createOrderIntake({
      clientEventId: randomUUID(),
      customer: {
        mode: "NEW",
        name: `Suchkunde ${suffix}`,
        customerType: "business",
        companyName: `Nordlicht ${suffix} GmbH`,
        contactPerson: "Ada Suchtest",
        email: `ada-${suffix}@local.invalid`,
        phone: null,
        city: "Esslingen",
      },
      dueDate: DUE_DATE,
      note: "Suchvertrag",
      items: [{
        name: `Pruefbolzen ${suffix}`,
        quantity: 2,
        material: `Titan ${suffix}`,
        surfaceRequested: `Hartchrom ${suffix}`,
      }],
    }));
    expect(intake.code).toBe("OK");
    if (intake.code !== "OK") throw new Error(`SEARCH_INTAKE_FAILED:${intake.code}`);
    const createdOrderId = intake.receipt.orderId;
    const createdCustomerId = intake.receipt.customerId;

    const { searchTenantAction } = await import("@/app/actions/search.actions");
    const orderQueries = [
      [intake.receipt.orderNumber, "orderNumber", intake.receipt.orderNumber],
      [`Pruefbolzen ${suffix}`, "part", `Pruefbolzen ${suffix}`],
      [`Titan ${suffix}`, "material", `Titan ${suffix}`],
      [`Hartchrom ${suffix}`, "surface", `Hartchrom ${suffix}`],
      [DUE_DATE, "dueDate", DUE_DATE],
      ["19.11.2026", "dueDate", "19.11.2026"],
    ] as const;
    for (const [query, matchField, matchValue] of orderQueries) {
      const result = await withRealSession(() => searchTenantAction(query));
      expect(result.code).toBe("OK");
      if (result.code === "OK") {
        const orderHits = result.hits.filter((hit) => hit.type === "ORDER");
        expect(orderHits).toContainEqual(expect.objectContaining({
          id: createdOrderId,
          source: "Auftragsbestand",
          matchField,
          matchValue,
          actionLabel: "Auftragskarte öffnen",
        }));
        expect(orderHits.every((hit) => hit.matchField === matchField && hit.matchValue === matchValue)).toBe(true);
      }
    }

    const customer = await withRealSession(() => searchTenantAction(`Nordlicht ${suffix}`));
    expect(customer.code).toBe("OK");
    if (customer.code === "OK") {
      expect(customer.hits.filter((hit) => hit.type === "CUSTOMER")).toEqual([
        expect.objectContaining({
          id: createdCustomerId,
          source: "Kundenstamm",
          matchField: "companyName",
          matchValue: `Nordlicht ${suffix} GmbH`,
          actionLabel: "Kundenkarte öffnen",
        }),
      ]);
    }

    const denied = await withRequest(null, () => searchTenantAction(intake.receipt.orderNumber));
    expect(denied).toEqual({ code: "UNAUTHENTICATED", message: expect.any(String) });

    const { readTenantOperationalOrders } = await import("@/lib/server/orderStationRead");
    const { searchOrderIntakeCustomers } = await import("@/lib/server/orderIntakeRead");
    const { searchTenant } = await import("@/modules/suche/public");
    const foreignTenant = `search-empty-${suffix}`;
    const foreign = await searchTenant(intake.receipt.orderNumber, {
      readOrders: () => readTenantOperationalOrders({ tenantId: foreignTenant }),
      searchCustomers: (query) => searchOrderIntakeCustomers({ tenantId: foreignTenant }, { query }),
    });
    expect(foreign).toEqual({ code: "OK", query: intake.receipt.orderNumber, hits: [] });

    await sql`UPDATE public.customers SET tenant_id = ${foreignTenant} WHERE id = ${createdCustomerId}`;
    const corrupt = await withRealSession(() => searchTenantAction(intake.receipt.orderNumber));
    expect(corrupt).toEqual({ code: "UNAVAILABLE", message: expect.any(String) });
    await sql`UPDATE public.customers SET tenant_id = ${KREILE_TENANT_SLUG} WHERE id = ${createdCustomerId}`;
  });
});
