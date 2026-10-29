// @vitest-environment jsdom

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";
import type { ManagedUser, SystemSettingsSnapshot } from "@/modules/fundament/public";

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
const secret = "h18-settings-client-local-only";
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = secret;

type Fixture = {
  actorId: string;
  targetId: string;
  issuedAt: number;
  actor: ManagedUser;
  target: ManagedUser;
};

async function availableShortCode(prefix: "U" | "V"): Promise<string> {
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

async function createFixture(label: string): Promise<Fixture> {
  const actorId = randomUUID();
  const targetId = randomUUID();
  const actorShortCode = await availableShortCode("U");
  const targetShortCode = await availableShortCode("V");
  const targetName = `H18 Client Ziel ${label}`;
  const pinHash = await bcrypt.hash("1111", 4);
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, kuerzel, bezeichnung, role, pin_hash, active, created_at, updated_at)
    VALUES
      (${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`client-actor-${actorId}@local.invalid`}, 'Rolf H18 Client', ${actorShortCode}, 'Firmeninhaber', 'meister', ${pinHash}, true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz),
      (${targetId}::uuid, ${KREILE_TENANT_SLUG}, ${`client-target-${targetId}@local.invalid`}, ${targetName}, ${targetShortCode}, 'Werkstatt', 'werkstatt', ${pinHash}, true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz)
  `;
  await sql`
    INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
    SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
    FROM unnest(ARRAY['logins', 'einstellungen']::text[]) area
  `;
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id = ${actorId}::uuid
  `;
  const issuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= issuedAt) throw new Error("H18_SESSION_ORDER_INVALID");
  return {
    actorId,
    targetId,
    issuedAt,
    actor: {
      id: actorId,
      email: `client-actor-${actorId}@local.invalid`,
      fullName: "Rolf H18 Client",
      shortCode: actorShortCode,
      designation: "Firmeninhaber",
      role: "meister",
      active: true,
      areas: ["logins", "einstellungen"],
      fixedAreas: [],
      isCurrent: true,
    },
    target: {
      id: targetId,
      email: `client-target-${targetId}@local.invalid`,
      fullName: targetName,
      shortCode: targetShortCode,
      designation: "Werkstatt",
      role: "werkstatt",
      active: true,
      areas: [],
      fixedAreas: [],
      isCurrent: false,
    },
  };
}

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/settings", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/settings",
    route: "/settings",
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
    { pathname: "/settings", search: "" },
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
    displayName: fixture.actor.fullName,
    issuedAt: fixture.issuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

function snapshot(fixture: Fixture): SystemSettingsSnapshot {
  return {
    company: {
      companyName: null,
      street: null,
      zip: null,
      city: null,
      country: null,
      taxId: null,
      iban: null,
      bic: null,
      bankName: null,
      paymentTermDays: null,
      logoUrl: null,
    },
    extraWorkHourlyRate: { rateId: null, hourlyRateCents: null, version: 0 },
    users: [fixture.actor, fixture.target],
    capabilities: { canManageCompany: true, canManageLogins: true, canManageSystem: false },
    numberRanges: [],
    features: [],
  };
}

async function renderSettings(fixture: Fixture, returnTo = "/orders") {
  const { SettingsAdminClient } = await import("@/app/settings/SettingsAdminClient");
  render(<SettingsAdminClient initialSnapshot={snapshot(fixture)} initialServices={[]} returnTo={returnTo} />);
  fireEvent.click(screen.getByRole("button", { name: "Logins & Rechte" }));
}

beforeAll(async () => {
  const migrations = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count FROM supabase_migrations.schema_migrations
  `;
  if (!migrations[0] || migrations[0].count < 1) throw new Error("H18_REPLAY_MIGRATIONS_MISSING");
});

afterEach(() => cleanup());

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("H18 settings client surfaces with real Server Action responses", () => {
  it("H18.1 shows the own-code success after the real action and closes only on success", async () => {
    const fixture = await createFixture("own-pin");
    await withSession(fixture, async () => {
      await renderSettings(fixture);
      fireEvent.click(screen.getByRole("button", { name: "Mein Code" }));
      const dialog = screen.getByRole("dialog", { name: "Mein Code ändern" });
      fireEvent.change(within(dialog).getByLabelText("Neuer Code"), { target: { value: "2468" } });
      fireEvent.change(within(dialog).getByLabelText("Code wiederholen"), { target: { value: "2468" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Code speichern" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Mein Code ändern" })).not.toBeInTheDocument(), { timeout: 20_000 });
      expect(screen.getByRole("status")).toHaveTextContent("Neuer Code gespeichert");
    });
    const [row] = await sql<{ pin_hash: string }[]>`SELECT pin_hash FROM public.app_users WHERE id = ${fixture.actorId}::uuid`;
    expect(await bcrypt.compare("2468", row!.pin_hash)).toBe(true);
  }, 30_000);

  it("H18.2 shows the managed-login success from saveManagedUserAction at the edit form", async () => {
    const fixture = await createFixture("other-pin");
    await withSession(fixture, async () => {
      await renderSettings(fixture);
      const card = screen.getAllByText(fixture.target.fullName)
        .map((node) => node.closest("article"))
        .find((node): node is HTMLElement => node !== null);
      expect(card).not.toBeNull();
      fireEvent.click(within(card!).getByRole("button", { name: "Ändern" }));
      fireEvent.change(within(card!).getByLabelText("Neuer Code"), { target: { value: "3579" } });
      fireEvent.click(within(card!).getByRole("button", { name: "Übernehmen" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`${fixture.target.fullName} gespeichert.`), { timeout: 20_000 });
    });
    const [row] = await sql<{ pin_hash: string }[]>`SELECT pin_hash FROM public.app_users WHERE id = ${fixture.targetId}::uuid`;
    expect(await bcrypt.compare("3579", row!.pin_hash)).toBe(true);
  }, 30_000);

  it("H18.3 shows the real rights-action success and H18.5 exposes the specified return path", async () => {
    const fixture = await createFixture("right");
    await withSession(fixture, async () => {
      await renderSettings(fixture, "/orders");
      expect(screen.getByRole("link", { name: "Schließen" })).toHaveAttribute("href", "/orders");
      fireEvent.click(screen.getByRole("checkbox", { name: `Aufträge & Werkstatt für ${fixture.target.fullName}` }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Recht ist sofort wirksam."), { timeout: 20_000 });
    });
    const [row] = await sql<{ granted_by: string }[]>`
      SELECT granted_by::text FROM public.app_user_rights
      WHERE tenant_id = ${KREILE_TENANT_SLUG} AND user_id = ${fixture.targetId}::uuid AND bereich = 'auftraege'
    `;
    expect(row).toEqual({ granted_by: fixture.actorId });
  }, 30_000);
});
