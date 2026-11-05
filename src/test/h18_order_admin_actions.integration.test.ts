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
  throw new Error("H18_ORDER_ADMIN_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_ORDER_ADMIN_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_ORDER_ADMIN_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-order-admin-actions-local-only";

type Fixture = { actorId: string; workerId: string; actorIssuedAt: number; customerId: string };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-order-admin-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-order-admin-actions",
    route: "/h18-order-admin-actions",
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
    { pathname: "/h18-order-admin-actions", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));
}

async function withSession<T>(fixture: Fixture, user: "actor" | "worker", work: () => Promise<T>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId: user === "actor" ? fixture.actorId : fixture.workerId,
    tenantId: KREILE_TENANT_SLUG,
    role: user === "actor" ? "meister" : "werkstatt",
    displayName: user === "actor" ? "Rolf H18 Auftrag" : "Phillip H18 Auftrag",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(): Promise<Fixture> {
  const actorId = randomUUID();
  const workerId = randomUUID();
  const customerId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES
        (${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-order-${actorId}@local.invalid`},
          'Rolf H18 Auftrag', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz),
        (${workerId}::uuid, ${KREILE_TENANT_SLUG}, ${`phillip-h18-order-${workerId}@local.invalid`},
          'Phillip H18 Auftrag', 'werkstatt', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz)
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(ARRAY['eingang', 'auftraege', 'kunden', 'geld', 'einstellungen']::text[]) area
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      VALUES (${KREILE_TENANT_SLUG}, ${workerId}::uuid, 'auftraege', ${actorId}::uuid)
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person, email, phone, street, zip_code, city, country, payment_preference, ziel_freigeschaltet, ziel_tage, source, first_name, last_name, salutation, house_number
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-O-${customerId.slice(0, 8)}`}, 'H18 Auftragskunde', 'H18 Auftragskunde GmbH', 'business', 'Ada Auftrag', ${`auftrag-${customerId}@local.invalid`}, '+49 711 5550193', (SELECT street FROM private.kunde_split_street('Auftragsweg 18')), '70179', 'Stuttgart', private.kunde_land_schluessel('Deutschland'), 'rechnung', true, 14, 'manual', (SELECT first_name FROM private.kunde_split_name('Ada Auftrag')), (SELECT last_name FROM private.kunde_split_name('Ada Auftrag')), (SELECT salutation FROM private.kunde_split_name('Ada Auftrag')), (SELECT house_number FROM private.kunde_split_street('Auftragsweg 18'))
      )
    `;
  });
  const rows = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM max(updated_at)) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id IN (${actorId}::uuid, ${workerId}::uuid)
  `;
  const actorIssuedAt = Date.now();
  if (!rows[0] || Number(rows[0].updated_at_ms) >= actorIssuedAt) throw new Error("H18_ORDER_ADMIN_SESSION_ORDER_INVALID");
  return { actorId, workerId, actorIssuedAt, customerId };
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

describe("H18 order administration Server Actions against the real replay database", () => {
  it("persists assignment, content, extra work and freeze correction with event and view readback", async () => {
    const fixture = await createFixture();
    const { createOrderIntakeAction } = await import("@/app/actions/eingang.actions");
    const intake = await withSession(fixture, "actor", () => createOrderIntakeAction({ geprueft: true,
      clientEventId: randomUUID(),
      customer: { mode: "EXISTING", customerId: fixture.customerId },
      dueDate: "2027-05-20",
      termStatus: "bestaetigt",
      intakeSource: "persoenlich",
      handoverMode: "pickup",
      paymentMode: "rechnung",
      note: "H18 Auftrag Verwaltung",
      items: [{
        catalogServiceId: null,
        name: "H18 Verwaltungsteil",
        quantity: 1,
        material: "Stahl",
        surfaceRequested: "Verchromen",
        executionRequested: "offen",
        unit: null,
        unitPriceCents: null,
        vatRateBasisPoints: null,
      }],
    }));
    expect(intake.code).toBe("OK");
    if (intake.code !== "OK") throw new Error(`H18_ORDER_ADMIN_INTAKE_FAILED:${intake.code}:${intake.message}`);
    const orderId = intake.receipt.orderId;
    const itemId = intake.receipt.items[0]!.id;
    let version = 1;
    const {
      assignOrderTaskAction,
      changeOrderContentAction,
      changeOrderItemExtraWorkAction,
      configureExtraWorkCatalogPositionAction,
      freezeOrderAction,
      getExtraWorkMasterDataAction,
      getLiveOrderCardAction,
      handBackOrderTaskAction,
      reopenFrozenOrderAction,
      setExtraWorkHourlyRateAction,
      transitionWareneingangToGalvanikAction,
    } = await import("@/app/actions/orders.actions");

    const assignEventId = randomUUID();
    const assigned = await withSession(fixture, "actor", () => assignOrderTaskAction({
      orderId,
      assigneeUserId: fixture.workerId,
      expectedVersion: version,
      clientEventId: assignEventId,
    }));
    expect(assigned.code).toBe("OK");
    if (assigned.code !== "OK") throw new Error(`H18_ORDER_ASSIGN_FAILED:${assigned.code}:${assigned.message}`);
    version = assigned.receipt.aggregateVersion;
    const [assignedRow] = await sql<{ active: boolean; assigned_to: string; event_type: string }[]>`
      SELECT state.active, state.assigned_to::text, event.event_type
      FROM private.order_task_assignment_state state
      JOIN public.events event ON event.tenant_id=state.tenant_id AND event.client_event_id=${assignEventId}::uuid
      WHERE state.order_id=${orderId} AND state.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(assignedRow).toEqual({ active: true, assigned_to: fixture.workerId, event_type: "ORDER_TASK_ASSIGNED_V1" });
    await expect(withSession(fixture, "actor", () => getLiveOrderCardAction({ orderId }))).resolves.toMatchObject({
      code: "OK",
      data: { card: { version, assignment: { assignedTo: fixture.workerId, active: true } } },
    });

    const handBackEventId = randomUUID();
    const handedBack = await withSession(fixture, "worker", () => handBackOrderTaskAction({
      orderId,
      expectedVersion: version,
      clientEventId: handBackEventId,
    }));
    expect(handedBack.code).toBe("OK");
    if (handedBack.code !== "OK") throw new Error(`H18_ORDER_HANDBACK_FAILED:${handedBack.code}:${handedBack.message}`);
    version = handedBack.receipt.aggregateVersion;
    const [handedBackRow] = await sql<{ active: boolean; handed_back_by: string; event_type: string }[]>`
      SELECT state.active, state.handed_back_by::text, event.event_type
      FROM private.order_task_assignment_state state
      JOIN public.events event ON event.tenant_id=state.tenant_id AND event.client_event_id=${handBackEventId}::uuid
      WHERE state.order_id=${orderId} AND state.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(handedBackRow).toEqual({ active: false, handed_back_by: fixture.workerId, event_type: "ORDER_TASK_HANDED_BACK_V1" });
    await expect(withSession(fixture, "actor", () => getLiveOrderCardAction({ orderId }))).resolves.toMatchObject({
      code: "OK",
      data: { card: { version } },
    });

    const contentEventId = randomUUID();
    const content = await withSession(fixture, "actor", () => changeOrderContentAction({
      orderId,
      expectedVersion: version,
      clientEventId: contentEventId,
      note: "H18 Inhalt bearbeitet",
      items: [{
        id: itemId,
        catalogServiceId: null,
        name: "H18 Verwaltungsteil bearbeitet",
        quantity: 2,
        material: "Stahl",
        surface: "Verchromen",
        unit: null,
        unitPriceCents: null,
        vatRateBasisPoints: null,
      }],
    }));
    expect(content.code).toBe("OK");
    if (content.code !== "OK") throw new Error(`H18_ORDER_CONTENT_FAILED:${content.code}:${content.message}`);
    version = content.receipt.aggregateVersion;
    const [contentRow] = await sql<{ task: string; name: string; quantity: number; event_type: string }[]>`
      SELECT orders.task, item.name, item.quantity::double precision AS quantity, event.event_type
      FROM public.orders orders
      JOIN public.items item ON item.tenant_id=orders.tenant_id AND item.order_id=orders.id AND item.id=${itemId}
      JOIN public.events event ON event.tenant_id=orders.tenant_id AND event.client_event_id=${contentEventId}::uuid
      WHERE orders.id=${orderId} AND orders.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(contentRow).toEqual({
      task: "H18 Inhalt bearbeitet",
      name: "H18 Verwaltungsteil bearbeitet",
      quantity: 2,
      event_type: "ORDER_CONTENT_CHANGED_V1",
    });
    await expect(withSession(fixture, "actor", () => getLiveOrderCardAction({ orderId }))).resolves.toMatchObject({
      code: "OK",
      data: { card: { version, note: "H18 Inhalt bearbeitet", items: [{ id: itemId, name: "H18 Verwaltungsteil bearbeitet", quantity: 2 }] } },
    });

    const catalogPositionId = randomUUID();
    const catalogEventId = randomUUID();
    const catalog = await withSession(fixture, "actor", () => configureExtraWorkCatalogPositionAction({
      positionId: catalogPositionId,
      expectedVersion: 0,
      name: `H18 Richten ${catalogPositionId.slice(0, 8)}`,
      standardMinutes: 45,
      active: true,
      clientEventId: catalogEventId,
    }));
    expect(catalog.code).toBe("OK");
    if (catalog.code !== "OK") throw new Error(`H18_EXTRA_CATALOG_FAILED:${catalog.code}:${catalog.message}`);
    const [catalogRow] = await sql<{ name: string; version: number; event_type: string }[]>`
      SELECT position.name, position.version, event.event_type
      FROM private.extra_work_catalog_positions position
      JOIN public.events event ON event.tenant_id=position.tenant_id AND event.client_event_id=${catalogEventId}::uuid
      WHERE position.id=${catalogPositionId}::uuid AND position.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(catalogRow).toEqual({ name: `H18 Richten ${catalogPositionId.slice(0, 8)}`, version: 1, event_type: "EXTRA_WORK_CATALOG_CONFIGURED_V1" });
    await expect(withSession(fixture, "actor", () => getExtraWorkMasterDataAction())).resolves.toMatchObject({
      code: "OK",
      data: { catalog: expect.arrayContaining([expect.objectContaining({ id: catalogPositionId, version: 1 })]) },
    });

    const masterData = await withSession(fixture, "actor", () => getExtraWorkMasterDataAction());
    expect(masterData.code).toBe("OK");
    if (masterData.code !== "OK") throw new Error(`H18_EXTRA_MASTERDATA_FAILED:${masterData.code}:${masterData.message}`);
    const rateId = randomUUID();
    const rate = await withSession(fixture, "actor", () => setExtraWorkHourlyRateAction({
      rateId,
      expectedVersion: masterData.data.currentRate?.version ?? 0,
      hourlyRateCents: 14000,
      clientEventId: randomUUID(),
    }));
    expect(rate.code).toBe("OK");
    if (rate.code !== "OK") throw new Error(`H18_EXTRA_RATE_FAILED:${rate.code}:${rate.message}`);

    const transition = await withSession(fixture, "actor", () => transitionWareneingangToGalvanikAction({
      orderId,
      expectedVersion: version,
      clientEventId: randomUUID(),
    }));
    expect(transition.code).toBe("OK");
    if (transition.code !== "OK") throw new Error(`H18_EXTRA_TRANSITION_FAILED:${transition.code}:${transition.message}`);
    version = transition.receipt.aggregateVersion;

    const lineId = randomUUID();
    const extraEventId = randomUUID();
    const extra = await withSession(fixture, "actor", () => changeOrderItemExtraWorkAction({
      lineId,
      orderId,
      itemId,
      catalogPositionId,
      minutes: 60,
      active: true,
      expectedLineVersion: 0,
      expectedOrderVersion: version,
      clientEventId: extraEventId,
    }));
    expect(extra.code).toBe("OK");
    if (extra.code !== "OK") throw new Error(`H18_EXTRA_LINE_FAILED:${extra.code}:${extra.message}`);
    version = extra.receipt.aggregateVersion;
    const [extraRow] = await sql<{ minutes: number; version: number; event_type: string }[]>`
      SELECT line.minutes, line.version, event.event_type
      FROM private.order_item_extra_work line
      JOIN public.events event ON event.tenant_id=line.tenant_id AND event.client_event_id=${extraEventId}::uuid
      WHERE line.id=${lineId}::uuid AND line.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(extraRow).toEqual({ minutes: 60, version: 1, event_type: "ORDER_ITEM_EXTRA_WORK_CHANGED_V1" });
    await expect(withSession(fixture, "actor", () => getLiveOrderCardAction({ orderId }))).resolves.toMatchObject({
      code: "OK",
      data: { card: { version, items: [{ id: itemId, extraWork: [expect.objectContaining({ lineId, minutes: 60 })] }] } },
    });

    const frozen = await withSession(fixture, "actor", () => freezeOrderAction({
      orderId,
      freezeId: randomUUID(),
      expectedVersion: version,
      clientEventId: randomUUID(),
    }));
    expect(frozen.code).toBe("OK");
    if (frozen.code !== "OK") throw new Error(`H18_REOPEN_SETUP_FAILED:${frozen.code}:${frozen.message}`);
    version = frozen.receipt.aggregateVersion;
    const reopenEventId = randomUUID();
    const reopened = await withSession(fixture, "actor", () => reopenFrozenOrderAction({
      orderId,
      expectedVersion: version,
      reason: "H18 Fertigmeldung gezielt korrigiert",
      clientEventId: reopenEventId,
    }));
    expect(reopened.code).toBe("OK");
    if (reopened.code !== "OK") throw new Error(`H18_REOPEN_FAILED:${reopened.code}:${reopened.message}`);
    version = reopened.receipt.aggregateVersion;
    const [reopenRow] = await sql<{ reason: string; event_type: string }[]>`
      SELECT correction.reason, event.event_type
      FROM private.order_freeze_corrections correction
      JOIN public.events event ON event.id=correction.event_id AND event.tenant_id=correction.tenant_id
      WHERE correction.order_id=${orderId} AND correction.tenant_id=${KREILE_TENANT_SLUG}
        AND event.client_event_id=${reopenEventId}::uuid
    `;
    expect(reopenRow).toEqual({ reason: "H18 Fertigmeldung gezielt korrigiert", event_type: "ORDER_FREEZE_CORRECTED_V1" });
    await expect(withSession(fixture, "actor", () => getLiveOrderCardAction({ orderId }))).resolves.toMatchObject({
      code: "OK",
      data: { card: { version, station: "galvanik", status: "galvanik", freeze: null } },
    });
  });
});

// Owner model DA01/DA02, unchanged outcomes: explicit notice and explicit revocation.
describe("AP-EIN Teil 6: DA01/DA02 real Actions and DB",()=>{
 it("DA01 stores the confirmed collector; DA02 clears it and preserves both events",async()=>{
  const fixture=await createFixture();
  const {createOrderIntakeAction}=await import("@/app/actions/eingang.actions");
  const created=await withSession(fixture,"actor",()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:"EXISTING",customerId:fixture.customerId},dueDate:"2027-05-20",termStatus:"bestaetigt",intakeSource:"persoenlich",handoverMode:"pickup",paymentMode:"rechnung",note:"SYNTHETISCH DA01",items:[{catalogServiceId:null,name:"SYNTHETISCH DA01 Teil",quantity:1,material:null,surfaceRequested:"verchromen",unit:"stueck",unitPriceCents:null,vatRateBasisPoints:null}]}));
  expect(created.code).toBe("OK");if(created.code!=="OK")throw Error('DA01_ORDER_REQUIRED');
  const {readTenantOperationalOrders}=await import('@/lib/server/orderStationRead');
  const [release]=await sql`SELECT ausgabe_frei FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.orderId}`;
  const queue=await readTenantOperationalOrders({tenantId:KREILE_TENANT_SLUG});
  expect(queue.find(value=>value.id===created.receipt.orderId)?.ausgabeFrei).toBe(release.ausgabe_frei);
  const {changeOrderPickupNoticeAction,getOrderPickupNoticeAction}=await import("@/app/actions/orders.actions");
  const input={orderId:created.receipt.orderId,expectedVersion:1,clientEventId:randomUUID(),name:"Jens",note:"Mein Bruder holt ab",source:"notiz"};
  expect(await withSession(fixture,"actor",()=>changeOrderPickupNoticeAction(input))).toMatchObject({code:"OK",replayed:false});
  expect(await withSession(fixture,"actor",()=>changeOrderPickupNoticeAction(input))).toMatchObject({code:"OK",replayed:true});
  expect(await sql`SELECT pickup_by_name,pickup_by_source,pickup_by_login::text FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.orderId}`).toEqual([{pickup_by_name:"Jens",pickup_by_source:"notiz",pickup_by_login:fixture.actorId}]);
  expect(await withSession(fixture,"actor",()=>getOrderPickupNoticeAction({orderId:input.orderId}))).toMatchObject({code:"OK",data:{version:2,pickup_by_name:"Jens"}});
  expect(await withSession(fixture,"actor",()=>changeOrderPickupNoticeAction({...input,expectedVersion:2,clientEventId:randomUUID(),name:null,note:"Ich komme selbst"}))).toMatchObject({code:"OK",replayed:false});
  expect(await withSession(fixture,"actor",()=>getOrderPickupNoticeAction({orderId:input.orderId}))).toMatchObject({code:"OK",data:{version:3,pickup_by_name:null}});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${input.orderId} AND event_type='ORDER_PICKUP_NOTICE_CHANGED_V1'`).toHaveLength(2);
 });
 it("shipping settings use the one company row and reread the configured service",async()=>{
  const fixture=await createFixture();
  const {saveCompanySettingsAction,readShippingSettingsAction,saveShippingSettingsAction}=await import("@/app/actions/settings.actions");
  expect(await withSession(fixture,"actor",()=>saveCompanySettingsAction({companyName:"SYNTHETISCH Versand",street:"Prüfweg 18",zip:"70173",city:"Stuttgart",country:"DE",taxId:"DE000000001",iban:"DE02120300000000202051",bic:"BYLADEM1001",bankName:"SYNTHETISCH Bank",paymentTermDays:14,logoUrl:"https://example.invalid/logo.svg"}))).toMatchObject({code:"OK"});
  const before=await withSession(fixture,"actor",()=>readShippingSettingsAction());
  expect(before.code).toBe("OK");if(before.code!=="OK")throw Error('SHIPPING_SETTINGS_REQUIRED');
  const input={service:"SYNTHETISCH Paket "+randomUUID().slice(0,8),numberPattern:"^T[0-9]{6}$",numberHint:"T und sechs Ziffern",trackingUrl:"https://example.invalid/track/{nr}",expectedUpdatedAt:before.settings.updatedAt};
  expect(await withSession(fixture,"actor",()=>saveShippingSettingsAction(input))).toMatchObject({code:"OK",replayed:false});
  expect(await withSession(fixture,"actor",()=>saveShippingSettingsAction(input))).toMatchObject({code:"OK",replayed:true});
  expect(await withSession(fixture,"worker",()=>saveShippingSettingsAction(input))).toMatchObject({code:"FORBIDDEN"});
  expect(await withSession(fixture,"actor",()=>readShippingSettingsAction())).toMatchObject({code:"OK",settings:{service:input.service,numberPattern:input.numberPattern,numberHint:input.numberHint,trackingUrl:input.trackingUrl}});
  expect(await sql`SELECT versand_dienst,versand_nummer_format FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{versand_dienst:input.service,versand_nummer_format:input.numberPattern}]);
  expect(await sql`SELECT id FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='shipping_settings_updated' AND payload->'after'->>'service'=${input.service}`).toHaveLength(1);
 });
});
