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
  throw new Error("H18_MASTERDATA_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_MASTERDATA_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_MASTERDATA_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-masterdata-actions-local-only";

type Fixture = { actorId: string; actorIssuedAt: number };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-masterdata-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-masterdata-actions",
    route: "/h18-masterdata-actions",
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
    { pathname: "/h18-masterdata-actions", search: "" },
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
    displayName: "Rolf H18 Stammdaten",
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
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-masterdata-${actorId}@local.invalid`},
        'Rolf H18 Stammdaten', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(ARRAY['einstellungen', 'auftraege']::text[]) area
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_MASTERDATA_SESSION_ORDER_INVALID");
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
  const { SALES_STAGE_FEATURES } = await import("@/modules/fundament/public");
  for (const feature of SALES_STAGE_FEATURES) {
    await sql`
      INSERT INTO public.tenant_features (tenant, feature_id, enabled)
      VALUES (${KREILE_TENANT_SLUG}, ${feature.id}, ${feature.defaultEnabled})
      ON CONFLICT (tenant, feature_id) DO NOTHING
    `;
  }
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("H18 master-data Server Actions against the real replay database", () => {
  it("saves company settings with DB, event and settings-view readback", async () => {
    const fixture = await createFixture();
    const { readSettingsAction, saveCompanySettingsAction } = await import("@/app/actions/settings.actions");
    const input = {
      companyName: "H18 Stammdaten Galvanik GmbH",
      street: "Pruefstrasse 18",
      zip: "70173",
      city: "Stuttgart",
      country: "Deutschland",
      taxId: "DE123456789",
      iban: "DE02120300000000202051",
      bic: "BYLADEM1001",
      bankName: "H18 Testbank",
      paymentTermDays: 21,
      logoUrl: "https://example.invalid/h18-logo.svg",
    };

    const result = await withSession(fixture, () => saveCompanySettingsAction(input));
    expect(result.code).toBe("OK");
    const rows = await sql<{
      company_name: string;
      invoice_payment_term_days: number;
      event_type: string;
      actor_id: string;
    }[]>`
      SELECT settings.company_name, settings.invoice_payment_term_days,
        event.event_type, event.payload->>'actorId' AS actor_id
      FROM public.company_settings settings
      JOIN public.ui_events event ON event.tenant_id=settings.tenant_id
        AND event.event_type='company_settings_updated'
        AND event.payload->>'actorId'=${fixture.actorId}
      WHERE settings.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(rows).toEqual([{
      company_name: input.companyName,
      invoice_payment_term_days: input.paymentTermDays,
      event_type: "company_settings_updated",
      actor_id: fixture.actorId,
    }]);
    const view = await withSession(fixture, () => readSettingsAction());
    expect(view).toMatchObject({ code: "OK", snapshot: { company: input } });
  });

  it("saves a service-catalog entry with DB, event and settings-view readback", async () => {
    const fixture = await createFixture();
    const { readSettingsAction, saveCatalogServiceAction } = await import("@/app/actions/settings.actions");
    const input = {
      id: null,
      name: `H18 Katalog ${randomUUID().slice(0, 8)}`,
      surface: "Hartchrom",
      unit: "Stueck",
      netPriceCents: 12800,
      vatRateBasisPoints: 1900 as const,
      standardLeadTimeWorkingDays: 6,
      active: true,
    };

    const result = await withSession(fixture, () => saveCatalogServiceAction(input));
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error(`H18_CATALOG_SAVE_FAILED:${result.code}:${result.message}`);
    const [row] = await sql<{
      id: string;
      name: string;
      net_price_cents: number;
      event_type: string;
      actor_id: string;
    }[]>`
      SELECT service.id::text AS id, service.name, service.net_price_cents,
        event.event_type, event.payload->>'actorId' AS actor_id
      FROM public.catalog_services service
      JOIN public.ui_events event ON event.tenant_id=service.tenant_id
        AND event.event_type='catalog_service_saved'
        AND event.payload->>'serviceId'=service.id::text
      WHERE service.id=${result.service.id}::uuid AND service.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(row).toEqual({
      id: result.service.id,
      name: input.name,
      net_price_cents: input.netPriceCents,
      event_type: "catalog_service_saved",
      actor_id: fixture.actorId,
    });
    const view = await withSession(fixture, () => readSettingsAction());
    expect(view).toMatchObject({ code: "OK" });
    if (view.code !== "OK") throw new Error(`H18_CATALOG_VIEW_FAILED:${view.code}`);
    expect(view.services).toContainEqual(result.service);
  });

  it("sets the hourly rate with DB, event and master-data-view readback", async () => {
    const fixture = await createFixture();
    const { getExtraWorkMasterDataAction, setExtraWorkHourlyRateAction } = await import("@/app/actions/orders.actions");
    const before = await withSession(fixture, () => getExtraWorkMasterDataAction());
    expect(before.code).toBe("OK");
    if (before.code !== "OK") throw new Error(`H18_HOURLY_RATE_VIEW_FAILED:${before.code}:${before.message}`);
    const rateId = randomUUID();
    const clientEventId = randomUUID();
    const hourlyRateCents = 13500;

    const result = await withSession(fixture, () => setExtraWorkHourlyRateAction({
      rateId,
      expectedVersion: before.data.currentRate?.version ?? 0,
      hourlyRateCents,
      clientEventId,
    }));
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error(`H18_HOURLY_RATE_SAVE_FAILED:${result.code}:${result.message}`);
    const [row] = await sql<{
      id: string;
      hourly_rate_cents: number;
      version: number;
      event_type: string;
      actor_id: string;
    }[]>`
      SELECT rate.id::text AS id, rate.hourly_rate_cents, rate.version,
        event.event_type, event.user_id::text AS actor_id
      FROM private.extra_work_hourly_rates rate
      JOIN public.events event ON event.tenant_id=rate.tenant_id
        AND event.client_event_id=${clientEventId}::uuid
      WHERE rate.id=${rateId}::uuid AND rate.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(row).toEqual({
      id: rateId,
      hourly_rate_cents: hourlyRateCents,
      version: result.receipt.aggregateVersion,
      event_type: "EXTRA_WORK_RATE_SET_V1",
      actor_id: fixture.actorId,
    });
    const view = await withSession(fixture, () => getExtraWorkMasterDataAction());
    expect(view).toMatchObject({
      code: "OK",
      data: { currentRate: { id: rateId, hourlyRateCents, version: result.receipt.aggregateVersion } },
    });
  });
});
