// @vitest-environment node

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== LOCAL_DATABASE_URL) {
  throw new Error("PATH1_CUSTOMER_LOCAL_REQUIRED: local loopback DATABASE_URL required");
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL || process.env.SUPABASE_URL !== LOCAL_SUPABASE_URL) {
  throw new Error("PATH1_CUSTOMER_LOCAL_REQUIRED: local loopback Supabase URLs required");
}

const readAppSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_noStore: vi.fn() }));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const db = postgres(LOCAL_DATABASE_URL, { max: 3, prepare: false });
const suffix = randomUUID().slice(0, 8);
const users = {
  buero: randomUUID(),
  readonly: randomUUID(),
  foreign: randomUUID(),
};
const foreignTenant = `path1-customer-foreign-${suffix}`;

function setSession(userId: string, role: "buero" | "readonly", tenantId = KREILE_TENANT_SLUG) {
  readAppSession.mockResolvedValue({
    ok: true,
    session: {
      userId,
      tenantId,
      role,
      displayName: `Path1 ${role}`,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

function customerInput(label: string, clientEventId = randomUUID()) {
  return {
    city: "Teststadt",
    clientEventId,
    companyName: `SYNTHETISCH ${label} GmbH`,
    contactPerson: "Synthetische Testperson",
    customerType: "business" as const,
    email: `${label.toLowerCase()}-${suffix}@example.invalid`,
    name: `SYNTHETISCH ${label} ${suffix}`,
    phone: "+49 000 12345",
  };
}

beforeAll(async () => {
  const [version] = await db<{ version: number }[]>`
    SELECT current_setting('server_version_num')::integer AS version
  `;
  if (!version || version.version < 170000 || version.version >= 180000) {
    throw new Error(`PATH1_CUSTOMER_PG17_REQUIRED:${version?.version ?? "missing"}`);
  }
  const now = new Date(Date.now() - 5_000).toISOString();
  await db`
    INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES
      (${users.buero}::uuid, ${KREILE_TENANT_SLUG}, ${`path1-buero-${suffix}@example.invalid`}, 'Path1 Büro', 'buero', true, ${now}::timestamptz, ${now}::timestamptz),
      (${users.readonly}::uuid, ${KREILE_TENANT_SLUG}, ${`path1-readonly-${suffix}@example.invalid`}, 'Path1 Readonly', 'readonly', true, ${now}::timestamptz, ${now}::timestamptz),
      (${users.foreign}::uuid, ${foreignTenant}, ${`path1-foreign-${suffix}@example.invalid`}, 'Path1 Foreign', 'buero', true, ${now}::timestamptz, ${now}::timestamptz)
  `;
});

beforeEach(() => setSession(users.buero, "buero"));
afterAll(async () => db.end());

describe("PATH1 customer persistence", () => {
  it("legt einen Kunden atomar an, liest ihn kanonisch zurück und replayt denselben Receipt", async () => {
    const { createCustomerAction } = await import("@/app/actions/customers.actions");
    const input = customerInput("ERSTANLAGE");
    const first = await createCustomerAction(input);
    expect(first.code).toBe("OK");
    if (first.code !== "OK") return;
    expect(first.replayed).toBe(false);
    expect(first.receipt.customerNumber).toMatch(/^K-\d{4}-\d{4,}$/);
    expect(first.customer).toMatchObject({
      id: first.receipt.customerId,
      customerNumber: first.receipt.customerNumber,
      name: input.name,
      orderCount: 0,
    });

    const replay = await createCustomerAction(input);
    expect(replay).toMatchObject({
      code: "OK",
      replayed: true,
      receipt: { receiptId: first.receipt.receiptId, eventId: first.receipt.eventId },
    });
    const [counts] = await db<{ customers: number; events: number; receipts: number }[]>`
      SELECT
        (SELECT count(*)::integer FROM public.customers WHERE tenant_id = ${KREILE_TENANT_SLUG} AND source_ref = ${input.clientEventId}) AS customers,
        (SELECT count(*)::integer FROM public.events WHERE tenant_id = ${KREILE_TENANT_SLUG} AND client_event_id = ${input.clientEventId}::uuid) AS events,
        (SELECT count(*)::integer FROM private.customer_create_receipts WHERE tenant_id = ${KREILE_TENANT_SLUG} AND client_event_id = ${input.clientEventId}::uuid) AS receipts
    `;
    expect(counts).toEqual({ customers: 1, events: 1, receipts: 1 });
  });

  it("weist Intent-Konflikt ohne zweiten Write ab und vergibt fortlaufende DB-Nummern", async () => {
    const { createCustomerAction } = await import("@/app/actions/customers.actions");
    const firstInput = customerInput("NUMMER-A");
    const first = await createCustomerAction(firstInput);
    expect(first.code).toBe("OK");
    if (first.code !== "OK") return;
    const conflict = await createCustomerAction({ ...firstInput, city: "Andere Stadt" });
    expect(conflict).toMatchObject({ code: "CONFLICT" });
    const second = await createCustomerAction(customerInput("NUMMER-B"));
    expect(second.code).toBe("OK");
    if (second.code !== "OK") return;
    const firstNumber = Number(first.receipt.customerNumber.split("-").at(-1));
    const secondNumber = Number(second.receipt.customerNumber.split("-").at(-1));
    expect(secondNumber).toBe(firstNumber + 1);
  });

  it("isoliert Tenants über Command und kanonischen Read-Port", async () => {
    const { createCustomerCommand } = await import("@/modules/customers/server-public");
    const { readCustomerSummary } = await import("@/lib/server/customerSummaryRead");
    const foreign = await createCustomerCommand({
      tenantId: foreignTenant,
      userId: users.foreign,
      capabilities: { canCreateCustomer: true },
    }, customerInput("FOREIGN"));
    expect(foreign.code).toBe("OK");
    if (foreign.code !== "OK") return;
    const ownRead = await readCustomerSummary({
      active: true,
      displayName: "Path1 Büro",
      permissions: ["perm_view_leitstand", "perm_view_customers"],
      role: "buero",
      tenantId: KREILE_TENANT_SLUG,
      userId: users.buero,
    }, { customerId: foreign.receipt.customerId });
    expect(ownRead).toMatchObject({ code: "NOT_FOUND" });
  });

  it("hält Receipt und Ereignis append-only", async () => {
    const { createCustomerAction } = await import("@/app/actions/customers.actions");
    const created = await createCustomerAction(customerInput("IMMUTABLE"));
    expect(created.code).toBe("OK");
    if (created.code !== "OK") return;
    await expect(db`
      UPDATE private.customer_create_receipts
      SET city = 'Manipuliert'
      WHERE id = ${created.receipt.receiptId}::uuid
    `).rejects.toThrow();
    await expect(db`
      DELETE FROM public.events
      WHERE id = ${created.receipt.eventId}
    `).rejects.toThrow();
    const [persisted] = await db<{ city: string | null; event_count: number }[]>`
      SELECT
        receipt.city,
        (SELECT count(*)::integer FROM public.events event WHERE event.id = receipt.event_id) AS event_count
      FROM private.customer_create_receipts receipt
      WHERE receipt.id = ${created.receipt.receiptId}::uuid
    `;
    expect(persisted).toEqual({ city: "Teststadt", event_count: 1 });
  });

  it("verweigert fehlende Sitzung und fehlendes Recht ohne Mutation", async () => {
    const { createCustomerAction } = await import("@/app/actions/customers.actions");
    const noSessionInput = customerInput("NO-SESSION");
    readAppSession.mockResolvedValueOnce({ ok: false, reason: "NO_COOKIE" });
    await expect(createCustomerAction(noSessionInput)).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    const deniedInput = customerInput("READONLY");
    setSession(users.readonly, "readonly");
    await expect(createCustomerAction(deniedInput)).resolves.toMatchObject({ code: "FORBIDDEN" });
    const [count] = await db<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.customers
      WHERE tenant_id = ${KREILE_TENANT_SLUG}
        AND source_ref IN (${noSessionInput.clientEventId}, ${deniedInput.clientEventId})
    `;
    expect(count?.count).toBe(0);
  });
});
