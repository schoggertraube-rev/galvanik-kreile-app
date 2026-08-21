import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const LOCAL_DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_LOCAL_DATABASE_URL = process.env.F1_3_EXPECTED_DATABASE_URL;
if (!LOCAL_DATABASE_URL || !EXPECTED_LOCAL_DATABASE_URL || LOCAL_DATABASE_URL !== EXPECTED_LOCAL_DATABASE_URL) {
  throw new Error("F1_3_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal F1_3_EXPECTED_DATABASE_URL");
}
const parsedDatabaseUrl = new URL(LOCAL_DATABASE_URL);
if (
  parsedDatabaseUrl.protocol !== "postgresql:" ||
  parsedDatabaseUrl.hostname !== "127.0.0.1" ||
  parsedDatabaseUrl.pathname !== "/postgres" ||
  parsedDatabaseUrl.username !== "postgres"
) {
  throw new Error("F1_3_LOCAL_DATABASE_REQUIRED: expected the dedicated local Postgres database");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("F1_3_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));

const TENANT = "galvanik-kreile";
const FOREIGN_TENANT = "f1-3-foreign-tenant";
const EMPTY_TENANT = "f1-3-empty-tenant";
const ADMIN_ID = "31313131-3131-4313-8313-313131313131";
const READONLY_ID = "41414141-4141-4414-8414-414141414141";
const WORKSHOP_ID = "51515151-5151-4515-8515-515151515151";
const suffix = `${Date.now()}-${process.pid}`;
const sql = postgres(LOCAL_DATABASE_URL, { max: 2, prepare: false });

const adminAuthorization = {
  userId: ADMIN_ID,
  tenantId: TENANT,
  displayName: "F1.3 Admin",
  role: "admin" as const,
  permissions: ["perm_view_leitstand"] as const,
  active: true as const,
};
const foreignAuthorization = { ...adminAuthorization, tenantId: FOREIGN_TENANT };
const emptyAuthorization = { ...adminAuthorization, tenantId: EMPTY_TENANT };
const workshopAuthorization = {
  ...adminAuthorization,
  userId: WORKSHOP_ID,
  displayName: "F1.3 Werkstatt",
  role: "werkstatt" as const,
};

let orderId = "";
let customerId = "";
let itemId = "";
let orderVersion = 0;
let lineId = "";
let catalogId = "";
let rateId = "";
let firstFreezeId = "";
let firstFreezeClientEventId = "";

function setSession(userId: string, role: string, tenantId = TENANT) {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId,
      tenantId,
      role,
      displayName: role,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

beforeAll(async () => {
  const [{ server_version_num: version }] = await sql<{ server_version_num: string }[]>`
    SELECT current_setting('server_version_num') AS server_version_num
  `;
  if (!version?.startsWith("17")) throw new Error(`PostgreSQL 17 required, got ${version}`);
  await sql`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES
      (${ADMIN_ID}::uuid, ${TENANT}, ${`f1-3-admin-${suffix}@local.invalid`}, 'F1.3 Admin', 'admin', true, now(), now()),
      (${READONLY_ID}::uuid, ${TENANT}, ${`f1-3-readonly-${suffix}@local.invalid`}, 'F1.3 Readonly', 'readonly', true, now(), now()),
      (${WORKSHOP_ID}::uuid, ${TENANT}, ${`f1-3-workshop-${suffix}@local.invalid`}, 'F1.3 Werkstatt', 'werkstatt', true, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      active = true,
      updated_at = now()
  `;
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
});

describe("F1.3 DB-/Command-Vertragsintegration (Session-Port isoliert; kein Real-E2E-Beleg)", () => {
  it("creates real master data with immutable receipt readback", async () => {
    setSession(ADMIN_ID, "admin");
    const { configureExtraWorkCatalogPosition, setExtraWorkHourlyRate } = await import("@/lib/server/commands/extraWorkAdminCommand");
    catalogId = randomUUID();
    rateId = randomUUID();
    const catalog = await configureExtraWorkCatalogPosition({
      positionId: catalogId,
      expectedVersion: 0,
      name: `Richten ${suffix}`,
      standardMinutes: 45,
      active: true,
      clientEventId: randomUUID(),
    });
    expect(catalog.code).toBe("OK");
    const rate = await setExtraWorkHourlyRate({
      rateId,
      expectedVersion: 0,
      hourlyRateCents: 12_000,
      clientEventId: randomUUID(),
    });
    expect(rate.code).toBe("OK");

    const { readExtraWorkMasterData } = await import("@/lib/server/orderCardRead");
    const readback = await readExtraWorkMasterData(adminAuthorization);
    expect(readback.code).toBe("OK");
    if (readback.code !== "OK") throw new Error("master-data read failed");
    expect(readback.data.currentRate).toMatchObject({ id: rateId, hourlyRateCents: 12_000, version: 1 });
    expect(readback.data.catalog).toContainEqual(expect.objectContaining({ id: catalogId, standardMinutes: 45, active: true }));
    await expect(readExtraWorkMasterData(emptyAuthorization)).resolves.toEqual({
      code: "OK",
      data: { currentRate: null, catalog: [] },
    });
  });

  it("runs intake to galvanik and persists per-item extra work with receipt and readback", async () => {
    setSession(ADMIN_ID, "admin");
    const { createOrderIntake } = await import("@/lib/server/commands/orderIntakeCommand");
    const intake = await createOrderIntake({
      clientEventId: randomUUID(),
      customer: {
        mode: "NEW",
        name: `F1.3 Real Kunde ${suffix}`,
        customerType: "business",
        companyName: `F1.3 Betrieb ${suffix}`,
        contactPerson: "Mara Muster",
        email: `f1-3-customer-${suffix}@local.invalid`,
        phone: "+49 711 123456",
        city: "Stuttgart",
      },
      dueDate: "2026-09-30",
      note: `Reale F1.3 Auftragsnotiz ${suffix}`,
      items: [{ name: "Stoßstange", quantity: 2, material: "Stahl", surfaceRequested: "Verchromen" }],
    });
    expect(intake.code).toBe("OK");
    if (intake.code !== "OK") throw new Error("intake failed");
    orderId = intake.receipt.orderId;
    customerId = intake.receipt.customerId;
    itemId = intake.receipt.items[0]!.id;

    const { transitionWareneingangToGalvanik } = await import("@/lib/server/commands/orderStationCommand");
    const transition = await transitionWareneingangToGalvanik({
      orderId,
      expectedVersion: 1,
      clientEventId: randomUUID(),
    });
    expect(transition.code).toBe("OK");
    if (transition.code !== "OK") throw new Error("transition failed");
    orderVersion = transition.receipt.aggregateVersion;

    const { changeOrderItemExtraWork } = await import("@/lib/server/commands/orderExtraWorkCommand");
    lineId = randomUUID();
    const clientEventId = randomUUID();
    const changed = await changeOrderItemExtraWork({
      lineId,
      orderId,
      itemId,
      catalogPositionId: catalogId,
      minutes: 75,
      active: true,
      expectedLineVersion: 0,
      expectedOrderVersion: orderVersion,
      clientEventId,
    });
    expect(changed.code).toBe("OK");
    if (changed.code !== "OK") throw new Error("extra-work change failed");
    orderVersion = changed.receipt.aggregateVersion;

    const { readOrderItemExtraWorkReceipt } = await import("@/lib/server/extraWorkReceiptRead");
    await expect(readOrderItemExtraWorkReceipt(adminAuthorization, { orderId, clientEventId })).resolves.toEqual({
      code: "OK",
      data: changed.receipt,
    });
    const { readLiveOrderCard } = await import("@/lib/server/orderCardRead");
    const card = await readLiveOrderCard(adminAuthorization, { orderId });
    expect(card.code).toBe("OK");
    if (card.code !== "OK") throw new Error("live order card failed");
    expect(card.data).toMatchObject({ id: orderId, version: orderVersion, station: "galvanik", dueAt: "2026-09-30T00:00:00.000Z" });
    expect(card.data.items[0]).toMatchObject({
      id: itemId,
      position: 1,
      name: "Stoßstange",
      quantity: 2,
      material: "Stahl",
      surfaceRequested: "Verchromen",
    });
    expect(card.data.items[0]?.extraWork[0]).toMatchObject({
      lineId,
      minutes: 75,
      hourlyRateCents: 12_000,
      amountCents: 15_000,
      frozen: false,
    });
    await expect(readLiveOrderCard(foreignAuthorization, { orderId })).resolves.toMatchObject({ code: "NOT_FOUND" });
  });

  it("loads the live customer summary with Ware-im-Haus and rejects foreign tenant", async () => {
    const { readCustomerSummary } = await import("@/lib/server/customerSummaryRead");
    const summary = await readCustomerSummary(adminAuthorization, { customerId });
    expect(summary.code).toBe("OK");
    if (summary.code !== "OK") throw new Error("customer summary failed");
    expect(summary.data).toMatchObject({ id: customerId, wareImHaus: true, wareImHausCount: 1, orderCount: 1 });
    expect(summary.data.orders).toContainEqual(expect.objectContaining({ id: orderId, status: "galvanik" }));
    await expect(readCustomerSummary(foreignAuthorization, { customerId })).resolves.toMatchObject({ code: "NOT_FOUND" });
    await expect(readCustomerSummary(emptyAuthorization, { customerId })).resolves.toMatchObject({ code: "NOT_FOUND" });
  });

  it("assigns one shared order task and rejects foreign-tenant readback", async () => {
    setSession(ADMIN_ID, "admin");
    const { assignOrderTask } = await import("@/lib/server/commands/orderTaskAssignmentCommand");
    const clientEventId = randomUUID();
    const assigned = await assignOrderTask({
      orderId,
      assigneeUserId: WORKSHOP_ID,
      expectedVersion: orderVersion,
      clientEventId,
    });
    expect(assigned.code).toBe("OK");
    if (assigned.code !== "OK") throw new Error("assignment failed");
    orderVersion = assigned.receipt.aggregateVersion;

    const {
      readOrderTaskAssigneeOptions,
      readOrderTaskAssignment,
      readOrderTaskAssignmentReceipt,
    } = await import("@/lib/server/orderTaskAssignmentRead");
    await expect(readOrderTaskAssigneeOptions(adminAuthorization)).resolves.toMatchObject({
      code: "OK",
      data: expect.arrayContaining([
        expect.objectContaining({ userId: WORKSHOP_ID, fullName: "F1.3 Werkstatt", role: "werkstatt" }),
      ]),
    });
    await expect(readOrderTaskAssigneeOptions(workshopAuthorization)).resolves.toMatchObject({ code: "FORBIDDEN" });
    await expect(readOrderTaskAssignmentReceipt(adminAuthorization, { orderId, clientEventId })).resolves.toEqual({
      code: "OK",
      data: assigned.receipt,
    });
    await expect(readOrderTaskAssignment(workshopAuthorization, { orderId })).resolves.toMatchObject({
      code: "OK",
      data: {
        assignmentStateId: assigned.receipt.assignmentStateId,
        assignedTo: WORKSHOP_ID,
        assignedBy: ADMIN_ID,
        active: true,
        assignmentVersion: orderVersion,
        dueAt: "2026-09-30T00:00:00.000Z",
        isAssignedToCurrentUser: true,
      },
    });
    await expect(readOrderTaskAssignment(foreignAuthorization, { orderId })).resolves.toMatchObject({ code: "NOT_FOUND" });
    await expect(readOrderTaskAssignmentReceipt(foreignAuthorization, { orderId, clientEventId })).resolves.toEqual({
      code: "OK",
      data: null,
    });

    const { readLiveOrderCard } = await import("@/lib/server/orderCardRead");
    await expect(readLiveOrderCard(adminAuthorization, { orderId })).resolves.toMatchObject({
      code: "OK",
      data: {
        version: orderVersion,
        assignment: {
          assignedTo: WORKSHOP_ID,
          active: true,
          isAssignedToCurrentUser: false,
        },
      },
    });
  });

  it("allows handback only by the active assignee and confirms shared state", async () => {
    const { handBackOrderTask } = await import("@/lib/server/commands/orderTaskAssignmentCommand");
    setSession(ADMIN_ID, "admin");
    const deniedClientEventId = randomUUID();
    await expect(handBackOrderTask({
      orderId,
      expectedVersion: orderVersion,
      clientEventId: deniedClientEventId,
    })).resolves.toMatchObject({ code: "FORBIDDEN" });
    const [deniedWrites] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.events
      WHERE client_event_id = ${deniedClientEventId}::uuid
    `;
    expect(deniedWrites?.count).toBe(0);

    setSession(WORKSHOP_ID, "werkstatt");
    const clientEventId = randomUUID();
    const handedBack = await handBackOrderTask({ orderId, expectedVersion: orderVersion, clientEventId });
    expect(handedBack.code).toBe("OK");
    if (handedBack.code !== "OK") throw new Error("handback failed");
    orderVersion = handedBack.receipt.aggregateVersion;

    const { readOrderTaskAssignment, readOrderTaskAssignmentReceipt } = await import("@/lib/server/orderTaskAssignmentRead");
    await expect(readOrderTaskAssignmentReceipt(workshopAuthorization, { orderId, clientEventId })).resolves.toEqual({
      code: "OK",
      data: handedBack.receipt,
    });
    await expect(readOrderTaskAssignment(adminAuthorization, { orderId })).resolves.toMatchObject({
      code: "OK",
      data: {
        assignmentStateId: handedBack.receipt.assignmentStateId,
        assignedTo: WORKSHOP_ID,
        active: false,
        handedBackBy: WORKSHOP_ID,
        assignmentVersion: orderVersion,
        isAssignedToCurrentUser: false,
      },
    });
  });

  it("denies readonly mutation before writes", async () => {
    setSession(READONLY_ID, "readonly");
    const { changeOrderItemExtraWork } = await import("@/lib/server/commands/orderExtraWorkCommand");
    const clientEventId = randomUUID();
    await expect(changeOrderItemExtraWork({
      lineId,
      orderId,
      itemId,
      catalogPositionId: catalogId,
      minutes: 90,
      active: true,
      expectedLineVersion: 1,
      expectedOrderVersion: orderVersion,
      clientEventId,
    })).resolves.toMatchObject({ code: "FORBIDDEN" });
    const [count] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count FROM public.events WHERE client_event_id = ${clientEventId}::uuid
    `;
    expect(count?.count).toBe(0);
  });

  it("atomically freezes galvanik to fertig, confirms reload, replay, and no accounting mutation", async () => {
    setSession(ADMIN_ID, "admin");
    const [before] = await sql<{ db_geplant: string | null; db_ist: string | null; cost_count: number; price_count: number }[]>`
      SELECT orders.db_geplant::text, orders.db_ist::text,
        (SELECT count(*)::integer FROM public.order_cost_positions WHERE order_id = ${orderId}) AS cost_count,
        (SELECT count(*)::integer FROM public.price_lines WHERE order_id = ${orderId}) AS price_count
      FROM public.orders orders WHERE orders.id = ${orderId}
    `;
    const { freezeOrder } = await import("@/lib/server/commands/orderFreezeCommand");
    const freezeId = randomUUID();
    const clientEventId = randomUUID();
    firstFreezeId = freezeId;
    firstFreezeClientEventId = clientEventId;
    const frozen = await freezeOrder({ orderId, freezeId, expectedVersion: orderVersion, clientEventId });
    expect(frozen.code).toBe("OK");
    if (frozen.code !== "OK") throw new Error("freeze failed");
    expect(frozen.receipt).toMatchObject({
      freezeId,
      orderId,
      fromStation: "galvanik",
      toStation: "fertig",
      hourlyRateCents: 12_000,
      totalAmountCents: 15_000,
      lineCount: 1,
    });

    const { readOrderFrozenReceipt } = await import("@/lib/server/orderFreezeRead");
    await expect(readOrderFrozenReceipt(adminAuthorization, { orderId, clientEventId })).resolves.toEqual({
      code: "OK",
      data: frozen.receipt,
    });
    const { readLiveOrderCard } = await import("@/lib/server/orderCardRead");
    const reload = await readLiveOrderCard(adminAuthorization, { orderId });
    expect(reload.code).toBe("OK");
    if (reload.code !== "OK") throw new Error("frozen reload failed");
    expect(reload.data).toMatchObject({
      version: frozen.receipt.aggregateVersion,
      station: "fertig",
      status: "fertig",
      freeze: { freezeId, totalAmountCents: 15_000, lineCount: 1 },
    });
    expect(reload.data.items[0]?.extraWork[0]).toMatchObject({ amountCents: 15_000, frozen: true });
    await expect(freezeOrder({ orderId, freezeId, expectedVersion: orderVersion, clientEventId })).resolves.toEqual({
      code: "OK",
      receipt: frozen.receipt,
      replayed: true,
    });

    const [after] = await sql<{ db_geplant: string | null; db_ist: string | null; cost_count: number; price_count: number }[]>`
      SELECT orders.db_geplant::text, orders.db_ist::text,
        (SELECT count(*)::integer FROM public.order_cost_positions WHERE order_id = ${orderId}) AS cost_count,
        (SELECT count(*)::integer FROM public.price_lines WHERE order_id = ${orderId}) AS price_count
      FROM public.orders orders WHERE orders.id = ${orderId}
    `;
    expect(after).toEqual(before);
    await expect(sql`
      UPDATE private.order_item_extra_work SET minutes = 80 WHERE tenant_id = ${TENANT} AND id = ${lineId}::uuid
    `).rejects.toThrow(/ORDER_EXTRA_WORK_FROZEN/);
    orderVersion = frozen.receipt.aggregateVersion;
  });

  it("corrects one active freeze, preserves history, permits editing, and refreezes", async () => {
    setSession(ADMIN_ID, "admin");
    const { reopenFrozenOrder } = await import("@/lib/server/commands/orderFreezeCorrectionCommand");
    const correctionClientEventId = randomUUID();
    const corrected = await reopenFrozenOrder({
      orderId,
      expectedVersion: orderVersion,
      clientEventId: correctionClientEventId,
      reason: "Fertigmeldung nach Werkstattprüfung korrigiert",
    });
    expect(corrected.code).toBe("OK");
    if (corrected.code !== "OK") throw new Error("freeze correction failed");
    expect(corrected.receipt).toMatchObject({
      freezeId: firstFreezeId,
      correctedFreezeVersion: orderVersion,
      fromStation: "fertig",
      toStation: "galvanik",
    });
    orderVersion = corrected.receipt.aggregateVersion;

    const { readOrderFreezeCorrectionReceipt } = await import("@/lib/server/orderFreezeCorrectionRead");
    await expect(readOrderFreezeCorrectionReceipt(adminAuthorization, {
      orderId,
      clientEventId: correctionClientEventId,
    })).resolves.toEqual({ code: "OK", data: corrected.receipt });
    const { readOrderFrozenReceipt } = await import("@/lib/server/orderFreezeRead");
    await expect(readOrderFrozenReceipt(adminAuthorization, {
      orderId,
      clientEventId: firstFreezeClientEventId,
    })).resolves.toMatchObject({ code: "OK", data: { freezeId: firstFreezeId } });

    const { readLiveOrderCard } = await import("@/lib/server/orderCardRead");
    const correctedCard = await readLiveOrderCard(adminAuthorization, { orderId });
    expect(correctedCard.code).toBe("OK");
    if (correctedCard.code !== "OK") throw new Error("corrected card failed");
    expect(correctedCard.data).toMatchObject({
      version: orderVersion,
      station: "galvanik",
      status: "galvanik",
      freeze: null,
    });
    expect(correctedCard.data.items[0]?.extraWork[0]).toMatchObject({ frozen: false, lineVersion: 1 });

    const { changeOrderItemExtraWork } = await import("@/lib/server/commands/orderExtraWorkCommand");
    const changed = await changeOrderItemExtraWork({
      lineId,
      orderId,
      itemId,
      catalogPositionId: catalogId,
      minutes: 90,
      active: true,
      expectedLineVersion: 1,
      expectedOrderVersion: orderVersion,
      clientEventId: randomUUID(),
    });
    expect(changed.code).toBe("OK");
    if (changed.code !== "OK") throw new Error("post-correction edit failed");
    orderVersion = changed.receipt.aggregateVersion;

    const { freezeOrder } = await import("@/lib/server/commands/orderFreezeCommand");
    const secondFreezeId = randomUUID();
    const refrozen = await freezeOrder({
      orderId,
      freezeId: secondFreezeId,
      expectedVersion: orderVersion,
      clientEventId: randomUUID(),
    });
    expect(refrozen.code).toBe("OK");
    if (refrozen.code !== "OK") throw new Error("refreeze failed");
    expect(refrozen.receipt).toMatchObject({
      freezeId: secondFreezeId,
      totalAmountCents: 18_000,
      lineCount: 1,
    });
    orderVersion = refrozen.receipt.aggregateVersion;

    const history = await sql.begin(async (transaction) => {
      await transaction`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
      return transaction<{ freeze_id: string; active: boolean; correction_id: string | null }[]>`
        SELECT freeze_id::text, active, correction_id::text
        FROM private.v_order_freeze_state_v1
        WHERE tenant_id = ${TENANT} AND order_id = ${orderId}
        ORDER BY order_version
      `;
    });
    expect(history).toEqual([
      expect.objectContaining({ freeze_id: firstFreezeId, active: false }),
      expect.objectContaining({ freeze_id: secondFreezeId, active: true, correction_id: null }),
    ]);
  });

  it("blocks freeze correction when an invoice exists without creating a correction", async () => {
    setSession(ADMIN_ID, "admin");
    const invoiceId = randomUUID();
    await sql`
      INSERT INTO public.invoices
        (id, tenant_id, customer_id, order_id, invoice_number, amount_total, status)
      VALUES
        (${invoiceId}::uuid, ${TENANT}, ${customerId}, ${orderId}, ${`F1-3-${suffix}`}, 180.00, 'draft')
    `;
    const before = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM private.order_freeze_corrections
      WHERE tenant_id = ${TENANT} AND order_id = ${orderId}
    `;
    const clientEventId = randomUUID();
    const { reopenFrozenOrder } = await import("@/lib/server/commands/orderFreezeCorrectionCommand");
    await expect(reopenFrozenOrder({
      orderId,
      expectedVersion: orderVersion,
      clientEventId,
      reason: "Korrektur trotz Rechnung muss blockieren",
    })).resolves.toMatchObject({ code: "CONFLICT" });
    const after = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM private.order_freeze_corrections
      WHERE tenant_id = ${TENANT} AND order_id = ${orderId}
    `;
    expect(after).toEqual(before);
    const [event] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count FROM public.events WHERE client_event_id = ${clientEventId}::uuid
    `;
    expect(event?.count).toBe(0);
  });
});
