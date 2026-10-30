// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.P3_SEARCH_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("P3_SEARCH_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal P3_SEARCH_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("P3_SEARCH_LOCAL_DATABASE_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("P3_SEARCH_LOCAL_DATABASE_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const suffix = `${Date.now()}-${process.pid}`;
const secret = "p3-search-contract-local-only";
const originalSecret = process.env.APP_SESSION_SECRET;
const userId = randomUUID();
let sessionIssuedAt = 0;
process.env.APP_SESSION_SECRET = secret;

async function withRequest<T>(cookie: string | null, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/p3-search-test", { headers: cookie ? { cookie } : undefined });
  const workStore = {
    isStaticGeneration: false, page: "/p3-search-test", route: "/p3-search-test", afterContext: {},
    previouslyRevalidatedTags: [], refreshTagsByCacheKind: new Map(), shouldTrackFetchMetrics: false,
    deploymentId: "test", buildId: "test", cacheComponentsEnabled: false,
    runInCleanSnapshot: (fn: (...args: never[]) => unknown, ...args: never[]) => fn(...args),
    reactServerErrorsByDigest: new Map(),
  } as unknown as import("next/dist/server/app-render/work-async-storage.external").WorkStore;
  const requestStore = createRequestStoreForAPI(request, { pathname: "/p3-search-test", search: "" }, { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined as never);
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));
}

async function withSession<T>(work: () => Promise<T>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, readAppSession, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId, tenantId: KREILE_TENANT_SLUG, role: "meister", displayName: "Rolf", issuedAt: sessionIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  const cookie = `${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`;
  return withRequest(cookie, async () => {
    const readback = await readAppSession();
    if (!readback.ok) throw new Error(`P3_SEARCH_SESSION_READBACK_FAILED:${readback.reason}`);
    expect(readback.session).toMatchObject({ userId, tenantId: KREILE_TENANT_SLUG, role: "meister" });
    return work();
  });
}

beforeAll(async () => {
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql`INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (${userId}::uuid, ${KREILE_TENANT_SLUG}, ${`p3-search-${suffix}@local.invalid`}, 'Rolf', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz)`;
  const [clock] = await sql<{ updated_at_ms: string }[]>`SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms FROM public.app_users WHERE id = ${userId}::uuid`;
  sessionIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= sessionIssuedAt) throw new Error("P3_SEARCH_SESSION_REVOCATION_ORDER_INVALID");
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET; else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("Path-1 P3 tenant search real database contract", () => {
  it("finds F1.1 order/customer facts and fails closed across session and tenant boundaries", async () => {
    const { createOrderIntake } = await import("@/lib/server/commands/orderIntakeCommand");
    const intake = await withSession(() => createOrderIntake({
      clientEventId: randomUUID(),
      customer: { mode: "NEW", name: `Suchkunde ${suffix}`, customerType: "business", companyName: `Nordlicht ${suffix} GmbH`, contactPerson: "Ada Suchtest", email: `ada-${suffix}@local.invalid`, phone: null, city: "Esslingen" },
      dueDate: "2026-11-19", note: "P3 Suchvertrag",
      items: [{ name: `Pruefbolzen ${suffix} Nordlicht`, quantity: 2, material: `Titan ${suffix}`, surfaceRequested: `Hartchrom ${suffix}` }],
    }));
    expect(intake.code).toBe("OK");
    if (intake.code !== "OK") throw new Error(`P3_SEARCH_INTAKE_FAILED:${intake.code}`);

    const { searchTenantAction } = await import("@/app/actions/search.actions");
    for (const [query, matchField] of [
      [intake.receipt.orderNumber, "orderNumber"], [`Pruefbolzen ${suffix}`, "part"],
      [`Titan ${suffix}`, "material"], [`Hartchrom ${suffix}`, "surface"], ["19.11.2026", "dueDate"],
    ] as const) {
      const result = await withSession(() => searchTenantAction(query));
      expect(result.code).toBe("OK");
      if (result.code === "OK") {
        expect(result.checkedSources).toEqual(["Auftragsbestand", "Kundenstamm"]);
        expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(result.hits).toContainEqual(expect.objectContaining({ id: intake.receipt.orderId, type: "ORDER", matchField }));
      }
    }

    const customer = await withSession(() => searchTenantAction(`Nordlicht ${suffix}`));
    expect(customer.code).toBe("OK");
    if (customer.code === "OK") expect(customer.hits).toContainEqual(expect.objectContaining({ id: intake.receipt.customerId, type: "CUSTOMER", matchField: "companyName" }));

    const combined = await withSession(() => searchTenantAction(`${suffix} Nordlicht`));
    expect(combined.code).toBe("OK");
    if (combined.code === "OK") {
      expect(combined.hits).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: intake.receipt.orderId, type: "ORDER", matchField: "part", href: `/orders/${intake.receipt.orderId}` }),
        expect.objectContaining({ id: intake.receipt.customerId, type: "CUSTOMER", matchField: "customerRecord", href: `/customers/${intake.receipt.customerId}` }),
      ]));
      expect(combined.coverage.truncated).toBe(false);
    }

    await expect(withRequest(null, () => searchTenantAction(intake.receipt.orderNumber))).resolves.toMatchObject({ code: "UNAUTHENTICATED" });

    const { readTenantOperationalOrders } = await import("@/lib/server/orderStationRead");
    const { searchOrderIntakeCustomers } = await import("@/lib/server/orderIntakeRead");
    const { searchTenant } = await import("@/modules/suche/public");
    const foreign = await searchTenant(intake.receipt.orderNumber, {
      readOrders: () => readTenantOperationalOrders({ tenantId: `foreign-${suffix}` }),
      searchCustomers: async (query) => ({
        records: await searchOrderIntakeCustomers({ tenantId: `foreign-${suffix}` }, { query }),
        exhaustive: true,
      }),
      readTimestamp: () => new Date().toISOString(),
    });
    expect(foreign).toMatchObject({ code: "OK", hits: [] });

    await sql`UPDATE public.customers SET tenant_id = ${`foreign-${suffix}`} WHERE id = ${intake.receipt.customerId}`;
    await expect(withSession(() => searchTenantAction(intake.receipt.orderNumber))).resolves.toMatchObject({ code: "UNAVAILABLE" });
    await sql`UPDATE public.customers SET tenant_id = ${KREILE_TENANT_SLUG} WHERE id = ${intake.receipt.customerId}`;
  }, 30_000);
});
