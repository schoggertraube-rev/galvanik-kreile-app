// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H18_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const secret = "h18-settings-actions-local-only";
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = secret;

type Fixture = {
  actorId: string;
  targetId: string;
  customerId: string;
  actorIssuedAt: number;
  actorShortCode: string;
  targetShortCode: string;
  targetName: string;
};

async function availableShortCode(prefix: "R" | "Z"): Promise<string> {
  const rows = await sql<{ kuerzel: string }[]>`
    SELECT lower(kuerzel) AS kuerzel FROM public.app_users
    WHERE tenant_id = ${KREILE_TENANT_SLUG} AND kuerzel IS NOT NULL
  `;
  const existing = new Set(rows.map((row) => row.kuerzel));
  for (let index = 0; index < 36 * 36; index += 1) {
    const candidate = `${prefix}${index.toString(36).padStart(2, "0")}`.toUpperCase();
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error(`H18_SHORT_CODE_POOL_EXHAUSTED:${prefix}`);
}

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-settings-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-settings-actions",
    route: "/h18-settings-actions",
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
    { pathname: "/h18-settings-actions", search: "" },
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
    displayName: "Rolf H18",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(label: string): Promise<Fixture> {
  const actorId = randomUUID();
  const targetId = randomUUID();
  const customerId = randomUUID();
  const suffix = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  const targetName = `Ziel ${suffix}`;
  const actorShortCode = await availableShortCode("R");
  const targetShortCode = await availableShortCode("Z");
  const pinHash = await bcrypt.hash("1111", 4);
  await sql`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, kuerzel, bezeichnung, role, pin_hash, active, created_at, updated_at)
    VALUES
      (${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-${suffix}@local.invalid`}, 'Rolf H18', ${actorShortCode}, 'Firmeninhaber', 'meister', ${pinHash}, true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz),
      (${targetId}::uuid, ${KREILE_TENANT_SLUG}, ${`ziel-${suffix}@local.invalid`}, ${targetName}, ${targetShortCode}, 'Werkstatt', 'werkstatt', ${pinHash}, true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz)
  `;
  await sql`
    INSERT INTO public.customers (
      id, tenant_id, customer_number, name, company_name, type, contact_person,
      email, phone, street, zip_code, city, country, payment_preference,
      ziel_freigeschaltet, source
    ) VALUES (
      ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-${customerId.slice(0, 8)}`},
      ${`H18 Kunde ${label}`}, ${`H18 ${label} GmbH`}, 'business', 'Ada H18',
      ${`kunde-${customerId}@local.invalid`}, '+49 711 5550100', 'Prüfstraße 18',
      '70173', 'Stuttgart', 'DE', 'vorkasse', false, 'manual'
    )
  `;
  await sql`
    INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
    SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
    FROM unnest(ARRAY['logins', 'eingang', 'auftraege', 'kunden', 'geld']::text[]) area
  `;
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id = ${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_SESSION_ORDER_INVALID");
  return { actorId, targetId, customerId, actorIssuedAt, actorShortCode, targetShortCode, targetName };
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

describe("H18 settings Server Actions against the real replay database", () => {
  it("H18.1 invokes changeOwnPinAction and persists own_pin_changed without revoking the current session", async () => {
    const fixture = await createFixture("own-pin");
    const { changeOwnPinAction, setManagedUserAreaAction } = await import("@/app/actions/settings.actions");
    await withSession(fixture, async () => {
      await expect(changeOwnPinAction({ pin: "4826" })).resolves.toMatchObject({ code: "OK" });
      await expect(setManagedUserAreaAction({ userId: fixture.targetId, area: "kunden", granted: true })).resolves.toMatchObject({ code: "OK" });
    });
    const [row] = await sql<{ pin_hash: string; event_count: number }[]>`
      SELECT users.pin_hash,
        (SELECT count(*)::integer FROM public.ui_events events
         WHERE events.tenant_id = users.tenant_id AND events.event_type = 'own_pin_changed'
           AND events.payload->>'actorId' = ${fixture.actorId}) AS event_count
      FROM public.app_users users WHERE users.id = ${fixture.actorId}::uuid
    `;
    expect(row).toBeDefined();
    expect(await bcrypt.compare("4826", row!.pin_hash)).toBe(true);
    expect(row!.event_count).toBe(1);
  }, 30_000);

  it("H18.2 invokes saveManagedUserAction and stores the new code for another login", async () => {
    const fixture = await createFixture("other-pin");
    const { saveManagedUserAction } = await import("@/app/actions/settings.actions");
    await expect(withSession(fixture, () => saveManagedUserAction({
      userId: fixture.targetId,
      fullName: fixture.targetName,
      shortCode: fixture.targetShortCode,
      designation: "Werkstatt",
      active: true,
      pin: "5937",
    }))).resolves.toMatchObject({ code: "OK" });
    const [row] = await sql<{ pin_hash: string; event_count: number }[]>`
      SELECT users.pin_hash,
        (SELECT count(*)::integer FROM public.ui_events events
         WHERE events.tenant_id = users.tenant_id AND events.event_type = 'login_updated'
           AND events.payload->>'actorId' = ${fixture.actorId}
           AND events.payload->>'userId' = ${fixture.targetId}) AS event_count
      FROM public.app_users users WHERE users.id = ${fixture.targetId}::uuid
    `;
    expect(row).toBeDefined();
    expect(await bcrypt.compare("5937", row!.pin_hash)).toBe(true);
    expect(row!.event_count).toBe(1);
  }, 30_000);

  it("H18.3 invokes setManagedUserAreaAction and stores granted_by", async () => {
    const fixture = await createFixture("right");
    const { setManagedUserAreaAction } = await import("@/app/actions/settings.actions");
    await expect(withSession(fixture, () => setManagedUserAreaAction({
      userId: fixture.targetId,
      area: "auftraege",
      granted: true,
    }))).resolves.toMatchObject({ code: "OK" });
    const [row] = await sql<{ granted_by: string }[]>`
      SELECT granted_by::text FROM public.app_user_rights
      WHERE tenant_id = ${KREILE_TENANT_SLUG} AND user_id = ${fixture.targetId}::uuid AND bereich = 'auftraege'
    `;
    expect(row).toEqual({ granted_by: fixture.actorId });
  }, 30_000);

  it("C1a.2 invokes setManagedUserAreaAction and keeps maintenance developer-only", async () => {
    const fixture = await createFixture("maintenance-right");
    const { setManagedUserAreaAction } = await import("@/app/actions/settings.actions");
    await expect(withSession(fixture, () => setManagedUserAreaAction({
      userId: fixture.actorId,
      area: "wartung",
      granted: true,
    }))).resolves.toEqual({
      code: "CONFLICT",
      message: "Wartung, Stufen & Anbindungen ist nur für den Entwickler verfügbar.",
    });
    const [row] = await sql<{ right_count: number; event_count: number }[]>`
      SELECT
        (SELECT count(*)::integer FROM public.app_user_rights
         WHERE tenant_id = ${KREILE_TENANT_SLUG}
           AND user_id = ${fixture.actorId}::uuid
           AND bereich = 'wartung') AS right_count,
        (SELECT count(*)::integer FROM public.ui_events
         WHERE tenant_id = ${KREILE_TENANT_SLUG}
           AND event_type = 'login_right_changed'
           AND payload->>'actorId' = ${fixture.actorId}
           AND payload->>'area' = 'wartung') AS event_count
    `;
    expect(row).toEqual({ right_count: 0, event_count: 0 });
  }, 30_000);

  it("H18.4 invokes saveManagedUserAction, changes a name, and keeps the actor session usable", async () => {
    const fixture = await createFixture("name");
    const { saveManagedUserAction, setManagedUserAreaAction } = await import("@/app/actions/settings.actions");
    await withSession(fixture, async () => {
      await expect(saveManagedUserAction({
        userId: fixture.actorId,
        fullName: "Rolf Neuer Name",
        shortCode: fixture.actorShortCode,
        designation: "Firmeninhaber",
        active: true,
        pin: null,
      })).resolves.toMatchObject({ code: "OK" });
      await expect(setManagedUserAreaAction({ userId: fixture.targetId, area: "kunden", granted: true })).resolves.toMatchObject({ code: "OK" });
    });
    const [row] = await sql<{ full_name: string; granted_by: string | null }[]>`
      SELECT users.full_name,
        (SELECT granted_by::text FROM public.app_user_rights
         WHERE tenant_id = users.tenant_id AND user_id = ${fixture.targetId}::uuid AND bereich = 'kunden') AS granted_by
      FROM public.app_users users WHERE users.id = ${fixture.actorId}::uuid
    `;
    expect(row).toEqual({ full_name: "Rolf Neuer Name", granted_by: fixture.actorId });
  }, 30_000);

  it("H18.5 invokes readSettingsAction for the account return path and proves the current login row", async () => {
    const fixture = await createFixture("return-path");
    const { readSettingsAction } = await import("@/app/actions/settings.actions");
    const result = await withSession(fixture, () => readSettingsAction());
    expect(result).toMatchObject({ code: "OK" });
    if (result.code !== "OK") throw new Error(`H18_SETTINGS_READ_FAILED:${result.code}`);
    expect(result.snapshot.users.some((user) => user.id === fixture.actorId && user.isCurrent)).toBe(true);
    const [row] = await sql<{ id: string; active: boolean }[]>`
      SELECT id::text, active FROM public.app_users
      WHERE tenant_id = ${KREILE_TENANT_SLUG} AND id = ${fixture.actorId}::uuid
    `;
    expect(row).toEqual({ id: fixture.actorId, active: true });
  }, 30_000);

  it("H18.6 changes the promised due date through the action and still opens the order card", async () => {
    const fixture = await createFixture("due-date");
    const { createOrderIntakeAction } = await import("@/app/warendurchlauf/actions");
    const { changeOrderPromisedDueDateAction, getLiveOrderCardAction } = await import("@/app/actions/orders.actions");
    const intake = await withSession(fixture, () => createOrderIntakeAction({
      clientEventId: randomUUID(),
      customer: { mode: "EXISTING", customerId: fixture.customerId },
      dueDate: "2026-12-08",
      termStatus: "bestaetigt",
      intakeSource: "persoenlich",
      handoverMode: "pickup",
      paymentMode: "vorkasse",
      note: "H18 Terminänderung",
      items: [{
        catalogServiceId: null,
        name: "H18 Prüfkörper",
        quantity: 1,
        material: "Stahl",
        surfaceRequested: "Hartchrom",
        executionRequested: "offen",
        unit: null,
        unitPriceCents: null,
        vatRateBasisPoints: null,
      }],
    }));
    if (intake.code !== "OK") throw new Error(`H18_INTAKE_FAILED:${intake.code}:${intake.message}`);
    expect(intake.code).toBe("OK");

    const changed = await withSession(fixture, () => changeOrderPromisedDueDateAction({
      orderId: intake.receipt.orderId,
      expectedVersion: 1,
      dueDate: "2026-12-15",
      reason: "Kundenwunsch bestätigt",
      clientEventId: randomUUID(),
    }));
    expect(changed.code).toBe("OK");
    const card = await withSession(fixture, () => getLiveOrderCardAction({ orderId: intake.receipt.orderId }));
    expect(card.code).toBe("OK");
    if (card.code === "OK") {
      expect(card.data.card.dueAt?.slice(0, 10)).toBe("2026-12-15");
      expect(card.data.card.dueDateChanges[0]).toMatchObject({ changedTo: "2026-12-15", reason: "Kundenwunsch bestätigt" });
    }
    const [row] = await sql<{ promised_due_date: string; version: number; event_count: number }[]>`
      SELECT orders.promised_due_date::date::text AS promised_due_date, orders.version,
        (SELECT count(*)::integer FROM public.events events
         WHERE events.tenant_id = orders.tenant_id AND events.order_id = orders.id
           AND events.event_type = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1'
           AND events.payload->>'promisedDueDate' = '2026-12-15') AS event_count
      FROM public.orders orders WHERE orders.id = ${intake.receipt.orderId}
    `;
    expect(row).toEqual({ promised_due_date: "2026-12-15", version: 2, event_count: 1 });
  }, 30_000);

  it("H18.7 keeps an order with a card read error in getOrdersDb and exposes its code", async () => {
    const fixture = await createFixture("read-error");
    const { createOrderIntakeAction } = await import("@/app/warendurchlauf/actions");
    const intake = await withSession(fixture, () => createOrderIntakeAction({
      clientEventId: randomUUID(),
      customer: { mode: "EXISTING", customerId: fixture.customerId },
      dueDate: "2026-12-09",
      termStatus: "bestaetigt",
      intakeSource: "persoenlich",
      handoverMode: "pickup",
      paymentMode: "vorkasse",
      note: "H18 sichtbarer Lesefehler",
      items: [{
        catalogServiceId: null,
        name: "H18 Lesefehlerteil",
        quantity: 1,
        material: "Stahl",
        surfaceRequested: "Verzinken",
        executionRequested: "offen",
        unit: null,
        unitPriceCents: null,
        vatRateBasisPoints: null,
      }],
    }));
    if (intake.code !== "OK") throw new Error(`H18_INTAKE_FAILED:${intake.code}:${intake.message}`);
    expect(intake.code).toBe("OK");
    await sql`UPDATE public.orders SET intake_term_status = 'verschoben' WHERE id = ${intake.receipt.orderId}`;

    const { getOrdersDb } = await import("@/app/actions/orders.actions");
    const listed = await withSession(fixture, () => getOrdersDb());
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data).toContainEqual(expect.objectContaining({
        id: intake.receipt.orderId,
        cardReadErrorCode: "ORDER_CARD_INTAKE_RECEIPT_INVALID",
      }));
    }
    const [row] = await sql<{ id: string; intake_term_status: string }[]>`
      SELECT id, intake_term_status FROM public.orders WHERE id = ${intake.receipt.orderId}
    `;
    expect(row).toEqual({ id: intake.receipt.orderId, intake_term_status: "verschoben" });
  }, 30_000);
});
