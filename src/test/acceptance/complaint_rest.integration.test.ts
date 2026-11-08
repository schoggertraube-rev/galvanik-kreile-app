// @vitest-environment node
// @vitest-environment node

import {seedSyntheticComplaintPhoto} from '@/test/fixtures/complaintPhoto';
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testTenant=vi.hoisted(()=> 'test-4c-rest-'+globalThis.crypto.randomUUID());
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
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_WORKSHOP_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, customerId };
}

async function createOrder(fixture: Fixture, label: string, paymentMode: "vorkasse" | "rechnung") {
  const { createOrderIntakeAction } = await import("@/app/actions/eingang.actions");
  const result = await withSession(fixture, () => createOrderIntakeAction({ geprueft: true,
    clientEventId: randomUUID(),
    customer: { mode: "EXISTING", customerId: fixture.customerId },
    dueDate: "2027-05-15",
    termStatus: "bestaetigt",
    intakeSource: "persoenlich",
    handoverMode: "pickup",
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
      unitPriceCents: null,
      vatRateBasisPoints: null,
    }],
  }));
  if (result.code !== "OK") throw new Error(`H18_WORKSHOP_INTAKE_FAILED:${result.code}:${result.message}`);
  return result.receipt;
}

async function deliveredComplaintSource(fixture:Fixture) {
  const order=await createOrder(fixture,'4C-TEST','rechnung');
  const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
  const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
  await sql`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by,effective_at)
    SELECT ${randomUUID()}::uuid,${KREILE_TENANT_SLUG},12000,coalesce(max(version),0)+1,${fixture.actorId}::uuid,now()
    FROM private.extra_work_hourly_rates WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  expect(await withSession(fixture,()=>transitionWareneingangToGalvanikAction({orderId:order.orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>setOrderItemFinishedAction({orderId:order.orderId,itemId:order.items[0].id,expectedVersion:2,clientEventId:randomUUID(),finished:true}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>freezeOrderAction({orderId:order.orderId,freezeId:randomUUID(),expectedVersion:3,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:4,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  return order;
}

async function complaintWrite(fixture:Fixture,input:import('@/modules/complaints/public').ComplaintCommand) {
  const {reklamationAusfuehrenAction,getByOrder}=await import('@/app/actions/complaints.actions');
  const result=await withSession(fixture,()=>reklamationAusfuehrenAction(input));
  expect(result.code,result.code==='OK'?'OK':result.message).toBe('OK');
  if(result.code!=='OK')throw Error(result.message);
  const [row]=await sql`SELECT complaint.id,complaint.nummer,complaint.stand,complaint.version,event.id AS event_id,event.payload
    FROM public.complaints complaint JOIN public.events event ON event.tenant_id=complaint.tenant_id AND event.order_id=complaint.order_id
    WHERE complaint.tenant_id=${KREILE_TENANT_SLUG} AND complaint.id=${result.receipt.complaintId} AND event.client_event_id=${input.clientKey}::uuid`;
  expect(row).toMatchObject({id:result.receipt.complaintId,nummer:result.receipt.number,stand:result.receipt.state,version:result.receipt.version,event_id:result.receipt.eventId,payload:{action:input.action,after:{stand:result.receipt.state}}});
  const [source]=await sql`SELECT order_id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${result.receipt.complaintId}`;
  const view=await withSession(fixture,()=>getByOrder(source.order_id));
  expect(view).toMatchObject({code:'OK',complaints:expect.arrayContaining([expect.objectContaining({id:result.receipt.complaintId,stand:result.receipt.state,version:result.receipt.version})])});
  return result.receipt;
}


afterAll(async()=>{await sql.end({timeout:1});if(originalSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=originalSecret;});

it('L08/L10/L11 real recording and credit actions persist one row, event, replay and both readbacks',async()=>{
 const fixture=await createFixture(),order=await deliveredComplaintSource(fixture);
 const {reklamationAusfuehrenAction,getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 const input:import('@/modules/complaints/public').ComplaintCommand={action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST L10 eindeutiger realer Klickweg',photoIds:await seedSyntheticComplaintPhoto(sql,{tenantId:KREILE_TENANT_SLUG,actorId:fixture.actorId,customerId:fixture.customerId,orderId:order.orderId}),goodsReturn:'offen'};
 const {reklamationAusfuehrenAction:recordComplaint}=await import('@/app/actions/complaints.actions');
 const emptyKey=randomUUID();
 expect(await withSession(fixture,()=>recordComplaint({...input,clientKey:emptyKey,photoIds:[]}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${emptyKey}::uuid`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${emptyKey}::uuid`).toHaveLength(0);
 const result=await complaintWrite(fixture,input);
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{complaintId:result.complaintId}});
 const [row]=await sql`SELECT count(*)::int AS n FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientKey}::uuid`;
 expect(row.n).toBe(1);
 expect(await withSession(fixture,()=>getComplaintDialogAction({complaintId:result.complaintId}))).toMatchObject({code:'OK',data:{complaint:{stand:'aufgenommen',mangel:'Blasen',wareZurueck:'offen'}}});
 await complaintWrite(fixture,{action:'entscheiden',clientKey:randomUUID(),complaintId:result.complaintId,version:1,assessment:'kulanz',measure:'gutschrift',reason:'TEST Kulanzentscheidung',creditCents:5000});
 const credit={action:'gutschrift' as const,clientKey:randomUUID(),complaintId:result.complaintId,version:2,creditCents:5000,creditNumber:'GS-TEST-REST'};
 await complaintWrite(fixture,credit);
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction(credit))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>getComplaintDialogAction({complaintId:result.complaintId}))).toMatchObject({code:'OK',data:{complaint:{stand:'kunde_informieren',gutschriftBetrag:'50.00',gutschriftNr:'GS-TEST-REST'}}});
 const [proof]=await sql`SELECT id,nummer,order_id,stand,version,gutschrift_betrag::text,gutschrift_nr FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${result.complaintId}`;
 console.info('TEST_4C_REST_DB_PROOF',JSON.stringify({tenant:KREILE_TENANT_SLUG,receivedEventId:result.eventId,row:proof}));
 await complaintWrite(fixture,{action:'abschliessen',clientKey:randomUUID(),complaintId:result.complaintId,version:3,kind:'ohne_mail',note:'TEST Kunde telefonisch informiert',sentThreadId:null});
 await complaintWrite(fixture,{action:'wieder_oeffnen',clientKey:randomUUID(),complaintId:result.complaintId,version:4,reason:'TEST weiterer Sachverhalt'});
 expect(await withSession(fixture,()=>getComplaintDialogAction({complaintId:result.complaintId}))).toMatchObject({code:'OK',data:{complaint:{stand:'aufgenommen',version:5,gutschriftBetrag:'50.00',gutschriftNr:'GS-TEST-REST'}}});
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction({...credit,clientKey:randomUUID(),version:5,creditNumber:'GS-TEST-ZWEIT'}))).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('GS-TEST-REST besteht')});
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction({action:'entscheiden',clientKey:randomUUID(),complaintId:result.complaintId,version:5,assessment:'kulanz',measure:'gutschrift',reason:'TEST zweite Gutschrift',creditCents:3000}))).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('GS-TEST-REST besteht')});
 await complaintWrite(fixture,{action:'entscheiden',clientKey:randomUUID(),complaintId:result.complaintId,version:5,assessment:'abgelehnt',measure:'ablehnen',reason:'TEST neue Beanstandung abgelehnt',creditCents:null});
 expect((await sql`SELECT gutschrift_betrag::text,gutschrift_nr,version FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${result.complaintId}`)[0]).toMatchObject({gutschrift_betrag:'50.00',gutschrift_nr:'GS-TEST-REST',version:6});
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction(credit))).toMatchObject({code:'OK',replayed:true,receipt:{version:3}});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${credit.clientKey}::uuid`).toHaveLength(1);
 expect(await withSession(fixture,()=>getComplaintDialogAction({complaintId:result.complaintId}))).toMatchObject({code:'OK',data:{complaint:{version:6,gutschriftBetrag:'50.00',gutschriftNr:'GS-TEST-REST'}}});
 const {createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const quoteInput={clientEventId:randomUUID(),customerId:fixture.customerId,sourceComplaintId:result.complaintId,dueDate:'2027-04-20',note:'TEST AF12 berechnete Reklamation',positions:[{name:'TEST erneute Bearbeitung',quantity:1,material:'Stahl',surfaceRequested:'verchromen',unitPriceCents:1000}]};
 const quote=await withSession(fixture,()=>createQuoteAction(quoteInput));
 expect(quote).toMatchObject({code:'OK',quote:{sourceComplaintId:result.complaintId,totalNetCents:1000}});
 if(quote.code!=='OK')throw Error('TEST AF12 creation failed');
 expect(await withSession(fixture,()=>createQuoteAction(quoteInput))).toMatchObject({code:'OK',replayed:true,quote:{quoteId:quote.quote.quoteId}});
 expect(await withSession(fixture,()=>createQuoteAction({...quoteInput,sourceComplaintId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:quote.quote.quoteId}))).toMatchObject({code:'OK',quote:{sourceComplaintId:result.complaintId,totalNetCents:1000}});
 expect((await sql`SELECT quelle_reklamation_id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quote.quote.quoteId}::uuid`)[0]).toMatchObject({quelle_reklamation_id:result.complaintId});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_COMPLAINT_LINKED_V1' AND user_id=${fixture.actorId}::uuid AND payload->>'quoteId'=${quote.quote.quoteId}`).toHaveLength(1);
 expect(await withSession(fixture,()=>createQuoteAction({...quoteInput,clientEventId:randomUUID(),positions:[{...quoteInput.positions[0],unitPriceCents:0}]}))).toMatchObject({code:'VALIDATION_ERROR'});
 const other=await createFixture();
 expect(await withSession(fixture,()=>createQuoteAction({...quoteInput,clientEventId:randomUUID(),customerId:other.customerId}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND quelle_reklamation_id=${result.complaintId}`).toHaveLength(1);
 console.info('TEST_AF12_DB_PROOF',JSON.stringify({quoteId:quote.quote.quoteId,complaintId:result.complaintId,priceCents:1000}));

});

it('AF-12 rejects an undecided complaint and rolls quote, event and receipt back together',async()=>{
 const fixture=await createFixture(),order=await deliveredComplaintSource(fixture);
 const source=await complaintWrite(fixture,{action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST AF12 noch nicht entschieden',photoIds:await seedSyntheticComplaintPhoto(sql,{tenantId:KREILE_TENANT_SLUG,actorId:fixture.actorId,customerId:fixture.customerId,orderId:order.orderId}),goodsReturn:'offen'});
 const {createQuoteAction}=await import('@/app/actions/quotes.actions');
 const key=randomUUID();
 expect(await withSession(fixture,()=>createQuoteAction({clientEventId:key,customerId:fixture.customerId,sourceComplaintId:source.complaintId,dueDate:'2027-04-20',note:'TEST AF12 forbidden source',positions:[{name:'TEST Halter',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND quelle_reklamation_id=${source.complaintId}`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toHaveLength(0);
 expect(await sql`SELECT receipt_id FROM private.v_quote_create_receipts_v1 WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toHaveLength(0);
 const {getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 expect(await withSession(fixture,()=>getComplaintDialogAction({complaintId:source.complaintId}))).toMatchObject({code:'OK',data:{complaint:{stand:'aufgenommen',version:1}}});
});
