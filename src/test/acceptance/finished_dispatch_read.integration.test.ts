// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testTenant=vi.hoisted(()=> 'test-r1-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:testTenant}));

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-workshop-actions-local-only";

type Fixture = { actorId: string; actorIssuedAt: number; customerId: string };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-workshop-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-workshop-actions",
    route: "/h18-workshop-actions",
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
    { pathname: "/h18-workshop-actions", search: "" },
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
    displayName: "Rolf TEST Reklamation Rest",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(areas:string[]=['eingang', 'auftraege', 'kunden', 'geld', 'kassieren', 'entscheiden']): Promise<Fixture> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-workshop-${actorId}@local.invalid`},
        'Rolf TEST Reklamation Rest', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${areas}::text[]) area
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person, email, phone, street, zip_code, city, country, payment_preference, ziel_freigeschaltet, ziel_tage, source, first_name, last_name, salutation, house_number
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-W-${customerId.slice(0, 8)}`}, 'TEST Reklamation Restkunde', 'TEST Reklamation Restkunde GmbH', 'business', 'Ada Werkstatt', ${`werkstatt-${customerId}@local.invalid`}, '+49 711 5550192', (SELECT street FROM private.kunde_split_street('Werkstattweg 18')), '70178', 'Stuttgart', private.kunde_land_schluessel('Deutschland'), 'rechnung', true, 14, 'manual', (SELECT first_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT last_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT salutation FROM private.kunde_split_name('Ada Werkstatt')), (SELECT house_number FROM private.kunde_split_street('Werkstattweg 18'))
      )
    `;
  });
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST R1 Firma','Testweg 18','70173','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE-TEST-R1',1900,14 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_WORKSHOP_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, customerId };
}

async function createOrder(fixture: Fixture, label: string, paymentMode: "vorkasse" | "rechnung",handoverMode:"pickup"|"shipping"="pickup") {
  const { createOrderIntakeAction } = await import("@/app/actions/eingang.actions");
  const result = await withSession(fixture, () => createOrderIntakeAction({ geprueft: true,
    clientEventId: randomUUID(),
    customer: { mode: "EXISTING", customerId: fixture.customerId },
    dueDate: "2027-05-15",
    termStatus: "bestaetigt",
    intakeSource: "persoenlich",
    handoverMode,
    paymentMode,
    note: `TEST Reklamation Rest ${label}`,
    items: [{
      catalogServiceId: null,
      name: `TEST Reklamation Restteil ${label}`,
      quantity: 1,
      material: "Stahl",
      surfaceRequested: "Verchromen",
      executionRequested: "offen",
      unit: null,
      unitPriceCents: 1000,
      vatRateBasisPoints: 1900,
    }],
  }));
  if (result.code !== "OK") throw new Error(`H18_WORKSHOP_INTAKE_FAILED:${result.code}:${result.message}`);
  return result.receipt;
}


afterAll(async()=>{await sql.end({timeout:1});if(originalSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=originalSecret;});

async function read(fixture:Fixture,id:string){return withSession(fixture,async()=>{const {resolveAuthorization}=await import('@/lib/server/authorization');const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST session');const {readFinishedDispatch}=await import('@/modules/orders/server-public');const {readCustomerProfile}=await import('@/modules/customers/server-public');return readFinishedDispatch(auth.data,id,{readCustomer:readCustomerProfile});});}
async function finish(fixture:Fixture,order:Awaited<ReturnType<typeof createOrder>>){
 const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction}=await import('@/app/actions/orders.actions');await sql`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by,effective_at) SELECT ${randomUUID()}::uuid,${KREILE_TENANT_SLUG},12000,coalesce(max(version),0)+1,${fixture.actorId}::uuid,now() FROM private.extra_work_hourly_rates WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(fixture,()=>transitionWareneingangToGalvanikAction({orderId:order.orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});expect(await withSession(fixture,()=>setOrderItemFinishedAction({orderId:order.orderId,itemId:order.items[0].id,expectedVersion:2,clientEventId:randomUUID(),finished:true}))).toMatchObject({code:'OK'});expect(await withSession(fixture,()=>freezeOrderAction({orderId:order.orderId,freezeId:randomUUID(),expectedVersion:3,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
}
it('R1 derives real workshop/finished/invoice/pickup/shipping facts without writing a station or treating a label as delivery',async()=>{
 const fixture=await createFixture(),order=await createOrder(fixture,'TEST R1 pickup','rechnung');expect(await read(fixture,order.orderId)).toMatchObject({code:'OK',projection:{stage:'workshop'}});await finish(fixture,order);expect(await read(fixture,order.orderId)).toMatchObject({code:'OK',projection:{stage:'S0',action:'releaseInvoice'}});
 const {issueInvoiceAction}=await import('@/app/actions/invoices.actions');const issued=await withSession(fixture,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:4,clientEventId:randomUUID()}));expect(issued.code,issued.code==='OK'?'OK':issued.message).toBe('OK');if(issued.code!=='OK')throw Error(issued.message);
 const issuedRead=await read(fixture,order.orderId);expect(issuedRead).toMatchObject({code:'OK',projection:{stage:'S1',action:'sendInvoice',informationAllowed:true}});if(issuedRead.code!=='OK')throw Error(issuedRead.message);
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');expect(await withSession(fixture,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:issuedRead.projection.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const before=await sql`SELECT version,(SELECT count(*)::int FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}) AS events FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;expect(await read(fixture,order.orderId)).toMatchObject({code:'OK',projection:{stage:'ended',goodsOutEventId:expect.any(String)}});expect(await sql`SELECT version,(SELECT count(*)::int FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}) AS events FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual(before);
 const shipping=await createOrder(fixture,'TEST R1 shipping','rechnung','shipping');await finish(fixture,shipping);await sql`INSERT INTO public.shipments(tenant_id,order_id,carrier,tracking_number,label_url,status,delivered_at) VALUES(${KREILE_TENANT_SLUG},${shipping.orderId},'TEST carrier','TEST label only','https://example.invalid/TEST-label.pdf','delivered',now())`;
 expect(await withSession(fixture,()=>recordGoodsOutAction({orderId:shipping.orderId,mode:'versand',expectedVersion:4,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});expect(await read(fixture,shipping.orderId)).toMatchObject({code:'OK',projection:{stage:'S5',gaps:expect.arrayContaining(['DELIVERY_NOT_CONFIRMED'])}});
 const denied=await createFixture(['auftraege','eingang','kunden']);expect(await read(denied,order.orderId)).toMatchObject({code:'FORBIDDEN'});
});
