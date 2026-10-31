// AP-01 Akzeptanztest - Kanal "Paket/persoenlich" (getippt -> Auftrag), eine Wahrheit.
// Planungschat-Vertrag. Codex kopiert diese Datei UNVERAENDERT nach src/test/acceptance/
// (SHA-256 in der Abgabe). Codex aendert Akzeptanztests nie; haelt er ihn fuer falsch -> BLOCKER.md.
//
// Prueft: getippter Eingang fuer einen BESTANDSKUNDEN erzeugt EINEN Auftrag ueber den
// kanonischen createOrderIntake und EIN intake_item + intake_event. Idempotenz ueber clientKey.
// Recht "eingang" erzwungen (Negativtest readonly). Kein zweiter Auftrags-Schreibweg.

import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const TENANT_A = KREILE_TENANT_SLUG;
const RUN_SUFFIX = randomUUID().slice(0, 8);

if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== LOCAL_DATABASE_URL) {
  throw new Error("AP01_LOCAL_REQUIRED: NODE_ENV=test, DATABASE_URL must equal local loopback");
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL || process.env.SUPABASE_URL !== LOCAL_SUPABASE_URL) {
  throw new Error("AP01_LOCAL_REQUIRED: Supabase URLs must be local 127.0.0.1:54321");
}

type AppRole = "developer" | "admin" | "meister" | "buero" | "werkstatt" | "readonly";
const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const USERS = { buero: randomUUID(), readonly: randomUUID() } as const;
const CUSTOMER_PREFIX = `ap01-eingang-${RUN_SUFFIX}`;

const fixtureSql = postgres(LOCAL_DATABASE_URL, { max: 4, prepare: false });
type UnsafeParameters = NonNullable<Parameters<typeof fixtureSql.unsafe>[1]>;
const pool = {
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    query: string, parameters: UnsafeParameters = [],
  ): Promise<{ rows: T[] }> {
    const rows = await fixtureSql.unsafe<T[]>(query, parameters);
    return { rows };
  },
};

let eingang: typeof import("@/app/eingang/actions");
let warendurchlauf: typeof import("@/app/warendurchlauf/actions");
let bestandskundeId = "";

function setSession(userId: string, role: string, tenantId = TENANT_A) {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId, tenantId, role: role as AppRole, displayName: role,
      issuedAt: 4_102_444_800_000, expiresAt: 4_102_488_000_000,
    },
  });
}

async function seedFixtures() {
  for (const [id, role, name] of [
    [USERS.buero, "buero", "Buero User"],
    [USERS.readonly, "readonly", "Readonly User"],
  ] as const) {
    await pool.query(
      `INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, '2026-01-01', '2026-01-01')`,
      [id, TENANT_A, `${role}-${RUN_SUFFIX}@test.local`, name, role],
    );
  }
  // Recht "eingang" nur fuer buero; readonly bekommt es NICHT.
  await pool.query(
    `INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by, granted_at)
     VALUES ($1, $2, 'eingang', $2, statement_timestamp())`,
    [TENANT_A, USERS.buero],
  );
}

beforeAll(async () => {
  eingang = await import("@/app/eingang/actions");
  warendurchlauf = await import("@/app/warendurchlauf/actions");
  await seedFixtures();

  // Bestandskunde ueber den KANONISCHEN Weg anlegen (keine zweite Auftragsanlage im Test).
  setSession(USERS.buero, "buero", TENANT_A);
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const seed = await warendurchlauf.createOrderIntakeAction({
    clientEventId: randomUUID(),
    customer: {
      mode: "NEW", name: `${CUSTOMER_PREFIX}-kunde`, customerType: "business",
      companyName: `${CUSTOMER_PREFIX} GmbH`, contactPerson: "Max Meister",
      email: `max-${RUN_SUFFIX}@example.local`, phone: "+49 123 456789", city: "Berlin",
    },
    dueDate, note: null,
    items: [{ name: "Grundteil", quantity: 1, material: "Stahl", surfaceRequested: "Galvanisieren" }],
  });
  if (seed.code !== "OK") throw new Error("AP01 seed Bestandskunde failed: " + seed.code);
  bestandskundeId = seed.receipt.customerId;
}, 30_000);

afterAll(async () => { await fixtureSql.end(); });
beforeEach(() => { setSession(USERS.buero, "buero", TENANT_A); });

function auftragInput(clientKey: string) {
  const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    clientKey,
    text: "2 Stueck Flansch verzinken, bis naechste Woche",
    customer: { mode: "EXISTING" as const, id: bestandskundeId },
    dueDate,
    items: [{ name: "Flansch", quantity: 2, material: "Stahl", surfaceRequested: "Verzinken" }],
  };
}

describe("AP-01 Kanal Paket/persoenlich: getippt -> Auftrag (Bestandskunde)", () => {
  it("legt EIN intake_item + EINEN Auftrag + intake_event an (eine Wahrheit)", async () => {
    const clientKey = randomUUID();
    const result = await eingang.erfasseAuftragAusEingangAction(auftragInput(clientKey));

    expect(result.code).toBe("OK");
    if (result.code !== "OK") return;
    expect(result.orderNumber).toMatch(/^A-\d{4}-\d{4,}$/);
    expect(result.intakeItemId).toBeTruthy();

    const item = await pool.query<Record<string, unknown>>(
      `SELECT kanal, richtung, quelle, kunde_id, vorgang_art, vorgang_id, zuordnung, text
         FROM public.intake_item WHERE tenant_id=$1 AND client_key=$2`,
      [TENANT_A, clientKey],
    );
    expect(item.rows).toHaveLength(1);
    expect(item.rows[0]).toMatchObject({
      kanal: "notiz", richtung: "rein", kunde_id: bestandskundeId,
      vorgang_art: "auftrag", vorgang_id: result.orderNumber, zuordnung: "hand",
    });

    const order = await pool.query(
      `SELECT order_number FROM public.orders WHERE tenant_id=$1 AND order_number=$2`,
      [TENANT_A, result.orderNumber],
    );
    expect(order.rows).toHaveLength(1);

    const events = await pool.query<{ art: string }>(
      `SELECT art FROM public.intake_event WHERE tenant_id=$1 AND item_id=$2 ORDER BY zeit`,
      [TENANT_A, result.intakeItemId],
    );
    const arten = events.rows.map((r) => r.art);
    expect(arten).toContain("angelegt");
    expect(arten).toContain("zugeordnet");

    const created = await pool.query(
      `SELECT 1 FROM public.events
        WHERE tenant_id=$1 AND event_type='ORDER_INTAKE_CREATED_V1' AND status='success'
          AND user_id=$2`,
      [TENANT_A, USERS.buero],
    );
    expect(created.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("ist idempotent ueber clientKey: zweiter Aufruf legt keine zweite Zeile an", async () => {
    const clientKey = randomUUID();
    const first = await eingang.erfasseAuftragAusEingangAction(auftragInput(clientKey));
    expect(first.code).toBe("OK");
    const second = await eingang.erfasseAuftragAusEingangAction(auftragInput(clientKey));
    expect(["OK", "CONFLICT"]).toContain(second.code);

    const rows = await pool.query(
      `SELECT id FROM public.intake_item WHERE tenant_id=$1 AND client_key=$2`,
      [TENANT_A, clientKey],
    );
    expect(rows.rows).toHaveLength(1);
  });

  it("verweigert ohne Recht 'eingang' (readonly) und schreibt nichts", async () => {
    setSession(USERS.readonly, "readonly", TENANT_A);
    const clientKey = randomUUID();
    const result = await eingang.erfasseAuftragAusEingangAction(auftragInput(clientKey));
    expect(result.code).toBe("FORBIDDEN");

    const rows = await pool.query(
      `SELECT id FROM public.intake_item WHERE tenant_id=$1 AND client_key=$2`,
      [TENANT_A, clientKey],
    );
    expect(rows.rows).toHaveLength(0);
  });
});
