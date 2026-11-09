import {seedSyntheticComplaintPhoto} from '@/test/fixtures/complaintPhoto';
// @vitest-environment node
// @vitest-environment node

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
      unitPriceCents: null,
      vatRateBasisPoints: null,
    }],
  }));
  if (result.code !== "OK") throw new Error(`H18_WORKSHOP_INTAKE_FAILED:${result.code}:${result.message}`);
  return result.receipt;
}

async function deliveredComplaintSource(fixture:Fixture,mode:'abholung'|'versand'='abholung') {
  const order=await createOrder(fixture,'4C-TEST','rechnung',mode==='versand'?'shipping':'pickup');
  const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
  const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
  await sql`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by,effective_at)
    SELECT ${randomUUID()}::uuid,${KREILE_TENANT_SLUG},12000,coalesce(max(version),0)+1,${fixture.actorId}::uuid,now()
    FROM private.extra_work_hourly_rates WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  expect(await withSession(fixture,()=>transitionWareneingangToGalvanikAction({orderId:order.orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>setOrderItemFinishedAction({orderId:order.orderId,itemId:order.items[0].id,expectedVersion:2,clientEventId:randomUUID(),finished:true}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>freezeOrderAction({orderId:order.orderId,freezeId:randomUUID(),expectedVersion:3,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>recordGoodsOutAction({orderId:order.orderId,mode,expectedVersion:4,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
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


it('AF-2: shipped goods remain claimable through the actual goods-out and complaint actions',async()=>{
 const fixture=await createFixture(),order=await deliveredComplaintSource(fixture,'versand');
 const [delivered]=await sql`SELECT o.station,e.payload->>'mode' AS mode FROM public.orders o JOIN public.events e ON e.tenant_id=o.tenant_id AND e.order_id=o.id AND e.event_type LIKE 'ORDER_PICKED_UP_%' WHERE o.tenant_id=${KREILE_TENANT_SLUG} AND o.id=${order.orderId}`;
 expect(delivered).toMatchObject({station:'abgeholt',mode:'versand'});
 const input:import('@/modules/complaints/public').ComplaintCommand={action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST AF2 nach tatsaechlichem Versand',photoIds:await seedSyntheticComplaintPhoto(sql,{tenantId:KREILE_TENANT_SLUG,actorId:fixture.actorId,customerId:fixture.customerId,orderId:order.orderId}),goodsReturn:'offen'};
 const result=await complaintWrite(fixture,input);
 const [event]=await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${result.eventId}`;
 expect(event.user_id).toBe(fixture.actorId);
 const {reklamationAusfuehrenAction}=await import('@/app/actions/complaints.actions');
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{complaintId:result.complaintId}});
 expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientKey}::uuid`).toHaveLength(1);
});

it('RM-04 no photo original produces the actionable error and no complaint or success event',async()=>{
 const fixture=await createFixture(),order=await deliveredComplaintSource(fixture);
 const {reklamationAusfuehrenAction,getByOrder}=await import('@/app/actions/complaints.actions');
 const clientKey=randomUUID();const input={action:'aufnehmen' as const,clientKey,orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST RM04 fehlendes Foto',photoIds:[],goodsReturn:'offen' as const};
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction(input))).toMatchObject({code:'VALIDATION_ERROR',message:'Fotos fehlen · Fotos anfordern'});
 expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${clientKey}::uuid`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid AND event_type='COMPLAINT_CHANGED_V1'`).toHaveLength(0);
 expect(await withSession(fixture,()=>getByOrder(order.orderId))).toMatchObject({code:'OK',complaints:[]});
});


it('RM02/RM05 actual complaint Action consumes two original reply photos and completes the same root once',async()=>{
 const fixture=await createFixture(['eingang','auftraege','kunden','geld','kassieren','entscheiden','mails']),order=await deliveredComplaintSource(fixture);
 const {rootId,replyId,photos}=await replyMailFixture(fixture,order);
 const {getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
 expect(await withSession(fixture,()=>getIntakeMessagesAction('offen'))).toMatchObject({code:'OK',messages:expect.arrayContaining([expect.objectContaining({id:rootId,photoReplies:[{replyId,orderId:order.orderId,photoIds:photos}]}),expect.objectContaining({id:replyId,photoParentId:rootId})])});
 const {getComplaintDialogAction,reklamationAusfuehrenAction}=await import('@/app/actions/complaints.actions');
 expect(await withSession(fixture,()=>getComplaintDialogAction({orderId:order.orderId,sourceItemId:replyId}))).toMatchObject({code:'OK',data:{initial:{photoIds:photos,intakeItemId:replyId,intakeVersion:1}}});
 const input={action:'aufnehmen' as const,clientKey:randomUUID(),orderId:order.orderId,intakeItemId:replyId,intakeVersion:1,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST Fotoantwort am selben Anliegen',photoIds:photos,goodsReturn:'offen' as const};
 const first=await withSession(fixture,()=>reklamationAusfuehrenAction(input));expect(first).toMatchObject({code:'OK'});if(first.code!=='OK')throw Error(first.message);
 expect(await sql`SELECT intake_item_id::text AS source,fotos FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.receipt.complaintId}`).toEqual([{source:replyId,fotos:photos}]);
 expect(await sql`SELECT id::text,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${[rootId,replyId]}::uuid[]) ORDER BY id`).toEqual([rootId,replyId].sort().map(id=>({id,einsatz:'erledigt',anliegen_offen:[]})));
 expect(await sql`SELECT von FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${rootId}::uuid AND nachher->>'action'='reklamation.aufgenommen_aus_fotoantwort'`).toEqual([{von:fixture.actorId}]);
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{complaintId:first.receipt.complaintId}});
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction({...input,clientKey:randomUUID()}))).not.toMatchObject({code:'OK'});
 expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND intake_item_id=${replyId}::uuid`).toHaveLength(1);
 expect(await withSession(fixture,()=>getIntakeMessagesAction('alle'))).toMatchObject({code:'OK',messages:expect.arrayContaining([expect.objectContaining({id:rootId,usage:'erledigt'}),expect.objectContaining({id:replyId,usage:'erledigt'})])});
});

async function replyMailFixture(fixture:Awaited<ReturnType<typeof createFixture>>,order:Awaited<ReturnType<typeof deliveredComplaintSource>>,attachmentMime="image/jpeg",requested=true){
 const rootId=randomUUID(),replyId=randomUUID(),threadId=randomUUID(),requestKey=randomUUID(),rootInternet='<TEST-root-'+rootId+'@example.invalid>',photos=[randomUUID(),randomUUID()];
 for(const id of [rootId,replyId]){
  await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,vorgang_art,vorgang_id,zuordnung,einsatz,text,anliegen,anliegen_offen,absender_adresse,graph_message_id,internet_message_id,empfangen_am) VALUES(${id}::uuid,${KREILE_TENANT_SLUG},${id},'mail','rein','mailabruf',${fixture.actorId}::uuid,${fixture.customerId},'auftrag',${order.orderId},'hand','offen','TEST Blasen an Teil, Originalfotos',ARRAY['reklamation'],ARRAY['reklamation'],'TEST-rekla@example.invalid',${'TEST-graph-'+id},${id===rootId?rootInternet:'<TEST-reply-'+replyId+'@example.invalid>'},statement_timestamp())`;
  const mimeId=randomUUID(),mimeHash=(id===rootId?'a':'b').repeat(64),fileIds=[mimeId,...(id===replyId?photos:[])];
  for(const [index,fileId]of fileIds.entries()){
   const hash=index?String(index).repeat(64):mimeHash;
   await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${id}::uuid,${fileId},${index?(attachmentMime.startsWith('image/')?'foto':'anhang'):'mime'},${index?(attachmentMime==='application/pdf'?'TEST Original.pdf':attachmentMime==='video/mp4'?'TEST Original.mp4':'TEST Foto.jpg'):'TEST Original.eml'},${index?attachmentMime:'message/rfc822'},32,${hash},${KREILE_TENANT_SLUG+'/'+hash},now(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
   await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${id}::uuid,'original_gespeichert',${fileId}::uuid,${fixture.actorId},${sql.json({fileId,sha256:hash,bytes:32})})`;
  }
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${id}::uuid,'angelegt',${randomUUID()}::uuid,${fixture.actorId},${sql.json({kanal:'mail',...(id===replyId?{complaintThreadParent:rootId}:{}),replyChain:{source:'original_mime',originalSha256:mimeHash,status:id===replyId?'present':'missing',inReplyTo:id===replyId?[rootInternet]:[],references:[]}})})`;
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${id}::uuid,'einsatz',${randomUUID()}::uuid,${fixture.actorId},${sql.json({action:'mail_import_complete',fileIds,originalCount:fileIds.length-1,filteredAttachments:0})})`;
 }
 // Existing sent-photo-request state is a synthetic fixture; this case tests the real complaint writer, not Microsoft.
 if(requested){await sql`INSERT INTO public.communication_threads(id,tenant_id,customer_id,order_id,source,subject,status,priority,category,created_by) VALUES(${threadId},${KREILE_TENANT_SLUG},${fixture.customerId},NULL,${'MS_GRAPH_OUT:'+requestKey},'TEST Fotos','sent','normal','email',${fixture.actorId})`;
 await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${rootId}::uuid,'anliegen',${requestKey}::uuid,${fixture.actorId},${sql.json({action:'reklamation.fotos_angefordert',customerId:fixture.customerId,sourceGraphId:'TEST-graph-'+rootId,threadId,originalSha256:'a'.repeat(64),intent:'TEST fixture'})})`;}
 return {rootId,replyId,photos};
}

it.each(['application/pdf','video/mp4'])('RM10 %s original remains readable but never counts as complaint photo',async(mime)=>{
 const fixture=await createFixture(['eingang','auftraege','kunden','geld','kassieren','entscheiden','mails']),order=await deliveredComplaintSource(fixture);
 const {rootId,replyId,photos}=await replyMailFixture(fixture,order,mime);
 const {reklamationAusfuehrenAction}=await import('@/app/actions/complaints.actions');
 const {getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
 const clientKey=randomUUID();
 const result=await withSession(fixture,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey,orderId:order.orderId,intakeItemId:replyId,intakeVersion:1,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST RM10 Original ist kein Foto',photoIds:photos,goodsReturn:'offen'}));
 expect(result).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND intake_item_id=${replyId}::uuid`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid AND event_type='COMPLAINT_CHANGED_V1'`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${photos}::uuid[]) AND mime=${mime}`).toHaveLength(2);
 const messages=await withSession(fixture,()=>getIntakeMessagesAction('offen'));
 expect(messages).toMatchObject({code:'OK',messages:expect.arrayContaining([expect.objectContaining({id:rootId,usage:'offen'}),expect.objectContaining({id:replyId,usage:'offen',photoCount:0})])});
 if(messages.code!=='OK')throw Error(messages.message);
 expect(messages.messages.find(row=>row.id===rootId)?.photoReplies??[]).toHaveLength(0);
});

it('RM13 actual stale source rejection rereads and resumes the same complaint identity once',async()=>{
 const fixture=await createFixture(['eingang','auftraege','kunden','geld','kassieren','entscheiden','mails']),order=await deliveredComplaintSource(fixture);
 const {replyId,photos}=await replyMailFixture(fixture,order);
 const {reklamationAusfuehrenAction,getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 const clientKey=randomUUID();
 const input={action:'aufnehmen' as const,clientKey,orderId:order.orderId,intakeItemId:replyId,intakeVersion:2,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST RM13 Eingabe bleibt erhalten',photoIds:photos,goodsReturn:'offen' as const};
 expect(await withSession(fixture,()=>reklamationAusfuehrenAction(input))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND intake_item_id=${replyId}::uuid`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid AND event_type='COMPLAINT_CHANGED_V1'`).toHaveLength(0);
 const fresh=await withSession(fixture,()=>getComplaintDialogAction({orderId:order.orderId,sourceItemId:replyId}));
 expect(fresh).toMatchObject({code:'OK',data:{initial:{intakeVersion:1,photoIds:photos}}});if(fresh.code!=='OK'||!('data'in fresh))throw Error('TEST RM13 reread');
 const saved=await withSession(fixture,()=>reklamationAusfuehrenAction({...input,intakeVersion:fresh.data.initial.intakeVersion}));
 expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error(saved.message);
 expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND intake_item_id=${replyId}::uuid`).toEqual([{id:saved.receipt.complaintId}]);
 expect(await sql`SELECT user_id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid AND event_type='COMPLAINT_CHANGED_V1'`).toEqual([{user_id:fixture.actorId}]);
 expect(await withSession(fixture,()=>getComplaintDialogAction({complaintId:saved.receipt.complaintId}))).toMatchObject({code:'OK',data:{complaint:{description:input.description,stand:'aufgenommen',version:1}}});
});

it('RM13/RM15 a forbidden mail complaint leaves no write; the authorized follow-up preserves the completed order',async()=>{
 const fixture=await createFixture(['eingang','auftraege','kunden','geld','kassieren','entscheiden','mails']),order=await deliveredComplaintSource(fixture);
 const {replyId,photos}=await replyMailFixture(fixture,order),denied=await createFixture(['eingang','mails','kunden']);
 const {reklamationAusfuehrenAction,getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 const input={action:'aufnehmen' as const,clientKey:randomUUID(),orderId:order.orderId,intakeItemId:replyId,intakeVersion:1,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST RM15 Folgebezug nach Abholung',photoIds:photos,goodsReturn:'offen' as const};
 const before=await sql`SELECT to_jsonb(kr_order.*) AS snapshot FROM public.orders kr_order WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 expect(before[0].snapshot.station).toBe('abgeholt');
 expect(await withSession(denied,()=>reklamationAusfuehrenAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND intake_item_id=${replyId}::uuid`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientKey}::uuid`).toHaveLength(0);
 const recorded=await withSession(fixture,()=>reklamationAusfuehrenAction(input));expect(recorded.code).toBe('OK');if(recorded.code!=='OK')throw Error(recorded.message);
 expect(await sql`SELECT to_jsonb(kr_order.*) AS snapshot FROM public.orders kr_order WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual(before);
 expect(await sql`SELECT order_id,intake_item_id::text AS intake_item_id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${recorded.receipt.complaintId}`).toEqual([{order_id:order.orderId,intake_item_id:replyId}]);
 expect(await withSession(fixture,()=>getComplaintDialogAction({complaintId:recorded.receipt.complaintId}))).toMatchObject({code:'OK',data:{complaint:{id:recorded.receipt.complaintId}}});
});

it.each([true,false])('RM07 actual mail Action reconciles a 503 without a blind second send (found=%s)',async(found)=>{
 const fixture=await createFixture(['eingang','kunden','mails']);
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const input={targetType:'CUSTOMER' as const,targetId:fixture.customerId,clientRequestId:randomUUID(),subject:'TEST RM07 Abgleich',body:'TEST eindeutige Versandkennung'};
 const {saveIntakeDraftAction,getIntakeDraftsAction}=await import('@/app/actions/eingang.actions');const draftId=randomUUID();
 expect(await withSession(fixture,()=>saveIntakeDraftAction({id:draftId,clientEventId:randomUUID(),art:'eingang',expectedVersion:null,lastField:null,payload:{kind:'TEST-RM07',clientKey:input.clientRequestId,request:input}}))).toMatchObject({code:'OK'});
 const resumed=await withSession(fixture,()=>getIntakeDraftsAction());if(resumed.code!=='OK')throw Error('TEST RM07 draft');const reread=resumed.drafts.find(row=>row.id===draftId)?.payload.request as typeof input;expect(reread).toEqual(input);expect(JSON.stringify(reread)).not.toBe(JSON.stringify(input));
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
 const keys=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const,before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));let sends=0,lookups=0;
 try{
  process.env.MS_GRAPH_TENANT_ID='TEST-tenant';process.env.MS_GRAPH_CLIENT_ID='TEST-client';process.env.MS_GRAPH_CLIENT_SECRET='TEST-provider-fixture';process.env.MS_GRAPH_MAILBOX='TEST-mailbox@example.invalid';
  vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{
   const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);
   if(target.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-provider-token-not-a-real-secret',expires_in:3600});
   if(target.hostname==='graph.microsoft.com'&&target.pathname.endsWith('/sendMail')){sends++;expect(JSON.parse(String(options?.body)).message.internetMessageHeaders).toEqual([{name:'x-kreile-send-id',value:sends===1?input.clientRequestId:expect.any(String)}]);return sends===1?new Response(null,{status:503}):new Response(null,{status:202});}
   if(target.pathname.endsWith('/mailFolders/sentitems/messages')){lookups++;return Response.json({value:found?[{id:'TEST-real-sent',internetMessageId:'<TEST-reconcile@example.invalid>',internetMessageHeaders:[{name:'x-kreile-send-id',value:input.clientRequestId}],from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString()}]:[]});}
   throw Error('TEST unexpected provider route '+target.pathname);
  });
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).toMatchObject({code:'UNAVAILABLE',delivery:'checking'});
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).toMatchObject({code:'CONFLICT',delivery:'checking'});expect(sends).toBe(1);expect(lookups).toBe(0);
  await sql`UPDATE public.communication_threads SET created_at=now()-interval '6 minutes' WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`;
  const result=await withSession(fixture,()=>sendCustomerMailAction(reread));expect(sends).toBe(1);expect(lookups).toBe(1);
  if(found){
   expect(result).toMatchObject({code:'OK'});
   expect(await sql`SELECT status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([{status:'sent'}]);
   expect(await sql`SELECT user_id,payload->>'graphMessageId' AS proof FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_SEND_RECONCILED_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{user_id:fixture.actorId,proof:'TEST-real-sent'}]);
   expect(await sql`SELECT message.body FROM public.communication_messages message JOIN public.communication_threads thread ON thread.tenant_id=message.tenant_id AND thread.id=message.thread_id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([{body:input.body}]);
   expect(await withSession(fixture,()=>sendCustomerMailAction({...input}))).toMatchObject({code:'OK',data:{replayed:true,customerId:fixture.customerId}});expect(sends).toBe(1);
  }else{
   expect(result).toMatchObject({code:'CONFLICT',delivery:'failed'});
   expect(await sql`SELECT status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([{status:'failed'}]);
   expect(await withSession(fixture,()=>sendCustomerMailAction({...input}))).toMatchObject({code:'CONFLICT',delivery:'failed'});expect(sends).toBe(1);
   expect(await withSession(fixture,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID()}))).toMatchObject({code:'OK'});expect(sends).toBe(2);
   expect(await sql`SELECT message.id FROM public.communication_messages message JOIN public.communication_threads thread ON thread.tenant_id=message.tenant_id AND thread.id=message.thread_id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.customer_id=${fixture.customerId} AND message.body=${input.body}`).toHaveLength(1);
  }
 }finally{vi.restoreAllMocks();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});

it('RM07 photo request retries with a new key only after proved absence and rereads waiting from its actual source receipt',async()=>{
 const fixture=await createFixture(['eingang','auftraege','kunden','geld','kassieren','entscheiden','mails']),order=await deliveredComplaintSource(fixture);
 const {rootId}=await replyMailFixture(fixture,order,'image/jpeg',false);
 await sql`INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables) VALUES(${KREILE_TENANT_SLUG},${KREILE_TENANT_SLUG+':reklamation_fotos_anfordern'},'TEST Fotos','TEST Fotos für {Kunde}','<p>TEST Fotos</p>','TEST Bitte Fotos senden {Kunde}','["Kunde"]'::jsonb)`;
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions'),{getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
 const input={targetType:'CUSTOMER' as const,targetId:fixture.customerId,clientRequestId:randomUUID(),subject:'',body:'',complaintPhotoRequest:{itemId:rootId,version:1}};
 const keys=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const,before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));let sends=0;
 try{
  process.env.MS_GRAPH_TENANT_ID='TEST-tenant';process.env.MS_GRAPH_CLIENT_ID='TEST-client';process.env.MS_GRAPH_CLIENT_SECRET='TEST-provider-fixture';process.env.MS_GRAPH_MAILBOX='TEST-mailbox@example.invalid';
  vi.spyOn(globalThis,'fetch').mockImplementation(async(url)=>{const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);if(target.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-provider-token-not-a-real-secret',expires_in:3600});if(target.pathname.endsWith('/reply')){sends++;return sends===1?new Response(null,{status:503}):new Response(null,{status:202});}if(target.pathname.endsWith('/mailFolders/sentitems/messages'))return Response.json({value:[]});throw Error('TEST unexpected graph route');});
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).toMatchObject({code:'UNAVAILABLE',delivery:'checking'});
  expect(await withSession(fixture,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID()}))).not.toMatchObject({code:'OK'});expect(sends).toBe(1);
  const unclear=await withSession(fixture,()=>getIntakeMessagesAction('offen'));if(unclear.code!=='OK')throw Error(unclear.message);expect(unclear.messages.find(row=>row.id===rootId)?.photoRequest).toBeUndefined();
  expect(unclear.messages.find(row=>row.id===rootId)?.photoDelivery).toMatchObject({state:'checking',clientRequestId:input.clientRequestId,version:1,retryAt:expect.any(String)});
  await sql`UPDATE public.communication_threads SET created_at=now()-interval '6 minutes' WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`;
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).toMatchObject({code:'CONFLICT',delivery:'failed'});
  const failed=await withSession(fixture,()=>getIntakeMessagesAction('offen'));if(failed.code!=='OK')throw Error(failed.message);expect(failed.messages.find(row=>row.id===rootId)?.photoDelivery).toMatchObject({state:'failed',clientRequestId:input.clientRequestId});
  const retryKey=randomUUID();expect(await withSession(fixture,()=>sendCustomerMailAction({...input,clientRequestId:retryKey}))).toMatchObject({code:'OK'});expect(sends).toBe(2);
  expect(await sql`SELECT von FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${rootId}::uuid AND befehl_id=${retryKey}::uuid AND nachher->>'action'='reklamation.fotos_angefordert'`).toEqual([{von:fixture.actorId}]);
  const waiting=await withSession(fixture,()=>getIntakeMessagesAction('offen'));expect(waiting).toMatchObject({code:'OK',messages:expect.arrayContaining([expect.objectContaining({id:rootId,photoRequest:expect.objectContaining({threadId:expect.any(String)})})])});
 }finally{vi.restoreAllMocks();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});

it('RM03 real reply Action sends the explicit response, completes root and reply with reason and creates no complaint',async()=>{
 const fixture=await createFixture(['eingang','auftraege','kunden','geld','kassieren','entscheiden','mails']),order=await deliveredComplaintSource(fixture);
 const {rootId,replyId}=await replyMailFixture(fixture,order);
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const {getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
 const input={targetType:'CUSTOMER' as const,targetId:fixture.customerId,clientRequestId:randomUUID(),subject:'TEST Antwort zu Ihren Fotos',body:'TEST Die sichtbare Stelle ist keine neue Reklamation.',complaintRejection:{itemId:replyId,version:1,reason:'TEST sichtbare Stelle entspricht dem vereinbarten Zustand'}};
 const {saveIntakeDraftAction,getIntakeDraftsAction}=await import('@/app/actions/eingang.actions');
 const draftId=randomUUID();expect(await withSession(fixture,()=>saveIntakeDraftAction({id:draftId,clientEventId:randomUUID(),art:'eingang',payload:{kind:'rekla-response',version:1,clientKey:input.clientRequestId,sourceItemId:replyId,request:input,attempted:true},lastField:null,expectedVersion:null}))).toMatchObject({code:'OK'});
 const resumed=await withSession(fixture,()=>getIntakeDraftsAction());if(resumed.code!=='OK')throw Error('TEST RM12 draft');const storedRequest=resumed.drafts.find(draft=>draft.id===draftId)?.payload.request as typeof input;expect(storedRequest).toEqual(input);expect(JSON.stringify(storedRequest)).not.toBe(JSON.stringify(input));
 const keys=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const,before=Object.fromEntries(keys.map(key=>[key,process.env[key]])),native=globalThis.fetch;let sends=0;
 try{
  process.env.MS_GRAPH_TENANT_ID='TEST-tenant';process.env.MS_GRAPH_CLIENT_ID='TEST-client';process.env.MS_GRAPH_CLIENT_SECRET='TEST-provider-fixture';process.env.MS_GRAPH_MAILBOX='TEST-mailbox@example.invalid';
  vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);if(target.hostname==='login.microsoftonline.com')return new Response(JSON.stringify({access_token:'TEST-provider-token-not-a-real-secret',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}});if(target.hostname==='graph.microsoft.com'&&target.pathname.endsWith('/reply')){sends++;return new Response(null,{status:202});}return native(url,options);});
  const sent=await withSession(fixture,()=>sendCustomerMailAction(input));expect(sent).toMatchObject({code:'OK'});
  expect(await sql`SELECT id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND intake_item_id=${replyId}::uuid`).toHaveLength(0);
  expect(await sql`SELECT id::text,einsatz,anliegen_offen,vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${[rootId,replyId]}::uuid[]) ORDER BY id`).toEqual([rootId,replyId].sort().map(id=>({id,einsatz:'erledigt',anliegen_offen:[],vorgang_id:order.orderId})));
  expect(await sql`SELECT von,nachher->>'reason' AS reason FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${replyId}::uuid AND nachher->>'action'='reklamation.keine_reklamation'`).toEqual([{von:fixture.actorId,reason:input.complaintRejection.reason}]);
  expect(await sql`SELECT user_id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientRequestId}::uuid AND event_type='INTAKE_COMPLAINT_RESPONSE_SENT_V1'`).toEqual([{user_id:fixture.actorId}]);
  expect(await sql`SELECT message.body,thread.status FROM public.communication_messages message JOIN public.communication_threads thread ON thread.tenant_id=message.tenant_id AND thread.id=message.thread_id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([{body:input.body,status:'sent'}]);
  expect(await withSession(fixture,()=>sendCustomerMailAction(storedRequest))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(1);
  expect(await withSession(fixture,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID()}))).not.toMatchObject({code:'OK'});expect(sends).toBe(1);
  expect(await withSession(fixture,()=>getIntakeMessagesAction('alle'))).toMatchObject({code:'OK',messages:expect.arrayContaining([expect.objectContaining({id:rootId,usage:'erledigt'}),expect.objectContaining({id:replyId,usage:'erledigt'})])});
 }finally{vi.restoreAllMocks();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});

it('AK complaint: two real actions retain the original and latest actor in the same complaint card',async()=>{
 const first=await createFixture(),second=await createFixture(),order=await deliveredComplaintSource(first);
 const photoIds=await seedSyntheticComplaintPhoto(sql,{tenantId:KREILE_TENANT_SLUG,actorId:first.actorId,customerId:first.customerId,orderId:order.orderId});
 const recorded=await complaintWrite(first,{action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST AK complaint actors',photoIds,goodsReturn:'offen'});
 await complaintWrite(second,{action:'entscheiden',clientKey:randomUUID(),complaintId:recorded.complaintId,version:1,assessment:'abgelehnt',measure:'ablehnen',reason:'TEST AK separate decision',creditCents:null});
 const {getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 expect(await withSession(first,()=>getComplaintDialogAction({complaintId:recorded.complaintId}))).toMatchObject({code:'OK',data:{complaint:{actorTrace:{createdBy:{userId:first.actorId},lastActor:{userId:second.actorId,action:'COMPLAINT_CHANGED_V1:entscheiden'}}}}});
});


it.each([false,true])('RM07 confirmed photo send preserves immutable proof after a foreign source change (reconcile=%s)',async reconcile=>{
 const fixture=await createFixture(['eingang','auftraege','kunden','geld','kassieren','entscheiden','mails']),order=await deliveredComplaintSource(fixture);
 const {rootId}=await replyMailFixture(fixture,order,'image/jpeg',false);
 await sql`INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables) VALUES(${KREILE_TENANT_SLUG},${KREILE_TENANT_SLUG+':reklamation_fotos_anfordern'},'TEST Fotos','TEST Fotos für {Kunde}','<p>TEST Fotos</p>','TEST Bitte Fotos senden {Kunde}','["Kunde"]'::jsonb) ON CONFLICT DO NOTHING`;
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions'),{getIntakeMessagesAction,saveIntakeDraftAction,getIntakeDraftsAction}=await import('@/app/actions/eingang.actions');
 const input={targetType:'CUSTOMER' as const,targetId:fixture.customerId,clientRequestId:randomUUID(),subject:'',body:'',complaintPhotoRequest:{itemId:rootId,version:1}},draftId=randomUUID();
 expect(await withSession(fixture,()=>saveIntakeDraftAction({id:draftId,clientEventId:randomUUID(),art:'eingang',expectedVersion:null,lastField:null,payload:{kind:'TEST-RM07-SOURCE',clientKey:input.clientRequestId,request:input}}))).toMatchObject({code:'OK'});
 const keys=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const,before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));let sends=0;
 const foreign=async()=>{await sql`UPDATE public.intake_item SET version=version+1,text='TEST fremde Bearbeitung erhalten' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${rootId}::uuid`;};
 try{
  process.env.MS_GRAPH_TENANT_ID='TEST-tenant';process.env.MS_GRAPH_CLIENT_ID='TEST-client';process.env.MS_GRAPH_CLIENT_SECRET='TEST-provider-fixture';process.env.MS_GRAPH_MAILBOX='TEST-mailbox@example.invalid';
  const [source]=await sql`SELECT absender_adresse FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${rootId}::uuid`;
  vi.spyOn(globalThis,'fetch').mockImplementation(async url=>{const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);if(target.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-provider-token-not-a-real-secret',expires_in:3600});if(target.pathname.endsWith('/reply')){sends++;if(!reconcile)await foreign();return new Response(null,{status:reconcile?503:202});}if(target.pathname.endsWith('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-confirmed-after-change',internetMessageId:'<TEST-after-change@example.invalid>',internetMessageHeaders:[{name:'x-kreile-send-id',value:input.clientRequestId}],from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:source.absender_adresse}}],isDraft:false,sentDateTime:new Date().toISOString()}]});throw Error('TEST unexpected provider route');});
  const sent=await withSession(fixture,()=>sendCustomerMailAction(input));
  if(reconcile){expect(sent).toMatchObject({code:'UNAVAILABLE',delivery:'checking'});await foreign();await sql`UPDATE public.communication_threads SET created_at=now()-interval '6 minutes' WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`;}
  const stored=await withSession(fixture,()=>getIntakeDraftsAction());if(stored.code!=='OK')throw Error('TEST reread');const reread=stored.drafts.find(row=>row.id===draftId)?.payload.request as typeof input;
  const result=reconcile?await withSession(fixture,()=>sendCustomerMailAction(reread)):sent;
  expect(result).toMatchObject({code:'OK',data:{sourceChanged:true,deliveryCustomer:expect.any(String)}});expect(sends).toBe(1);
  expect(await sql`SELECT message.id FROM public.communication_messages message JOIN public.communication_threads thread ON thread.tenant_id=message.tenant_id AND thread.id=message.thread_id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId} AND thread.status='sent'`).toHaveLength(1);
  expect(await sql`SELECT payload->'intake'->>'itemId' AS item,payload->'intake'->>'version' AS version FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_SOURCE_CHANGED_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{item:rootId,version:'1'}]);
  expect((await sql`SELECT version,text,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${rootId}::uuid`)[0]).toMatchObject({version:2,text:'TEST fremde Bearbeitung erhalten',anliegen_offen:expect.arrayContaining(['reklamation'])});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${rootId}::uuid AND nachher->>'action'='reklamation.fotos_angefordert'`).toHaveLength(0);
  const view=await withSession(fixture,()=>getIntakeMessagesAction('offen'));expect(view).toMatchObject({code:'OK',messages:expect.arrayContaining([expect.objectContaining({id:rootId,version:2,photoDelivery:expect.objectContaining({state:'source-changed',deliveryCustomer:expect.any(String)})})])});
  expect(await withSession(fixture,()=>sendCustomerMailAction(reread))).toMatchObject({code:'OK',data:{replayed:true,sourceChanged:true}});expect(sends).toBe(1);
 }finally{vi.restoreAllMocks();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
