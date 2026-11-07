// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Isolate configuration only; Actions, authorization, DB and transaction ports remain real.
const testTenant=vi.hoisted(()=> 'test-kv-v04-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:testTenant}));

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H18_QUOTE_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_QUOTE_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_QUOTE_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "TEST-kv-v04-local-only";

type Fixture = {
  actorId: string;
  actorIssuedAt: number;
  customerId: string;
};

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-quote-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-quote-actions",
    route: "/h18-quote-actions",
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
    { pathname: "/h18-quote-actions", search: "" },
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
    displayName: "TEST KV V04",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(settings=true): Promise<Fixture> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-quote-${actorId}@local.invalid`},
        'TEST KV V04', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${transaction.array(['eingang','auftraege','kunden','geld',...(settings?['einstellungen']:[])])}::text[]) area
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person, email, phone, street, zip_code, city, country, payment_preference, ziel_freigeschaltet, ziel_tage, source, first_name, last_name, salutation, house_number
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-KV-${customerId.slice(0, 8)}`}, 'TEST KV V04 Kunde', 'TEST KV V04 Kunde GmbH', 'business', 'Ada Angebot', ${`kv-${customerId}@local.invalid`}, '+49 711 5550189', (SELECT street FROM private.kunde_split_street('Angebotsweg 18')), '70175', 'Stuttgart', private.kunde_land_schluessel('Deutschland'), 'rechnung', true, 14, 'manual', (SELECT first_name FROM private.kunde_split_name('Ada Angebot')), (SELECT last_name FROM private.kunde_split_name('Ada Angebot')), (SELECT salutation FROM private.kunde_split_name('Ada Angebot')), (SELECT house_number FROM private.kunde_split_street('Angebotsweg 18'))
      )
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_QUOTE_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, customerId };
}

afterAll(async()=>{await sql.end({timeout:1});if(originalSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=originalSecret;});

describe('KV V04 exact line contract through real Actions, DB, events and view',()=>{
 it('retains 10.00 EUR for three parts, retries once without duplicate and updates the exact line',async()=>{
  const fixture=await createFixture();
  const {createQuoteAction,readQuoteAction,updateQuoteAction}=await import('@/app/actions/quotes.actions');
  const input={clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST KV V04 cent exact',positions:[{name:'TEST Halter',quantity:3,material:'Stahl',surfaceRequested:'verchromen',unitPriceCents:333,lineTotalCents:1000}]};
  const created=await withSession(fixture,()=>createQuoteAction(input));
  expect(created).toMatchObject({code:'OK',quote:{totalNetCents:1000,positions:[{quantity:3,lineTotalCents:1000}]}});
  if(created.code!=='OK')throw Error('KV_V04_CREATE:'+created.code+':'+created.message);
  const [row]=await sql`SELECT q.total_net_cents::text, q.fassung, p.zeilen_gesamt_cents::text, e.event_type FROM private.quotes q JOIN private.quote_positions p ON p.tenant_id=q.tenant_id AND p.quote_id=q.id AND p.revision=q.version JOIN public.events e ON e.tenant_id=q.tenant_id AND e.client_event_id=${input.clientEventId}::uuid WHERE q.tenant_id=${KREILE_TENANT_SLUG} AND q.id=${created.quote.quoteId}::uuid`;
  expect(row).toMatchObject({total_net_cents:'1000',zeilen_gesamt_cents:'1000',fassung:1,event_type:'QUOTE_CREATED_V1'});
  expect(await withSession(fixture,()=>createQuoteAction(input))).toMatchObject({code:'OK',replayed:true,quote:{quoteId:created.quote.quoteId}});
  expect((await sql`SELECT count(*)::int n FROM private.quote_create_receipts WHERE tenant_id=${KREILE_TENANT_SLUG} AND actor_id=${fixture.actorId}::uuid AND client_event_id=${input.clientEventId}::uuid`)[0].n).toBe(1);
  expect(await withSession(fixture,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{totalNetCents:1000}});
  const changed={quoteId:created.quote.quoteId,clientEventId:randomUUID(),expectedVersion:1,dueDate:input.dueDate,note:input.note,positions:[{...input.positions[0],lineTotalCents:1001}]};
  expect(await withSession(fixture,()=>updateQuoteAction(changed))).toMatchObject({code:'OK',quote:{version:2,totalNetCents:1001}});
  expect((await sql`SELECT q.total_net_cents::text,q.fassung,p.zeilen_gesamt_cents::text,e.event_type FROM private.quotes q JOIN private.quote_positions p ON p.tenant_id=q.tenant_id AND p.quote_id=q.id AND p.revision=q.version JOIN public.events e ON e.tenant_id=q.tenant_id AND e.client_event_id=${changed.clientEventId}::uuid WHERE q.tenant_id=${KREILE_TENANT_SLUG} AND q.id=${created.quote.quoteId}::uuid`)[0]).toMatchObject({total_net_cents:'1001',zeilen_gesamt_cents:'1001',fassung:1,event_type:'QUOTE_UPDATED_V1'});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:2,totalNetCents:1001}});
  expect(await withSession(fixture,()=>updateQuoteAction({...changed,clientEventId:randomUUID(),expectedVersion:2,positions:[{...input.positions[0],lineTotalCents:-1}]}))).toMatchObject({code:'VALIDATION_ERROR'});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:2,totalNetCents:1001}});
 });
});

it('KV-04/05 records sent edition, acceptance evidence, changes and decline through the real lifecycle Action',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,readQuoteAction,updateQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST Editionsteil',quantity:3,material:'Stahl',surfaceRequested:'verchromen',unitPriceCents:333,lineTotalCents:1000};
 const create=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST edition',positions:[position]}));
 if(create.code!=='OK')throw Error('KV_CREATE:'+create.code);
 const quoteId=create.quote.quoteId;
 const sent={action:'sent' as const,channel:'druck' as const,evidence:'TEST Ausdruck persönlich übergeben',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1};
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(sent))).toMatchObject({code:'OK',quote:{version:2,lifecycle:{edition:1,sentEdition:1,sentChannel:'druck',stage:'versendet'}}});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(sent))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({...sent,evidence:'TEST anders'}))).toMatchObject({code:'CONFLICT'});
 const accepted={action:'accept' as const,evidence:'TEST telefonisch aktuelle Fassung bestätigt',quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1};
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(accepted))).toMatchObject({code:'OK',quote:{version:3,lifecycle:{stage:'zugesagt',acceptedEdition:1,acceptanceEvidence:accepted.evidence}}});
 const [proof]=await sql`SELECT q.fassung,q.gesendet_fassung,q.zugesagt_fassung,q.zusage_nachweis,e.event_type FROM private.quotes q JOIN public.events e ON e.tenant_id=q.tenant_id AND e.client_event_id=${accepted.clientEventId}::uuid WHERE q.tenant_id=${KREILE_TENANT_SLUG} AND q.id=${quoteId}::uuid`;
 expect(proof).toMatchObject({fassung:1,gesendet_fassung:1,zugesagt_fassung:1,zusage_nachweis:accepted.evidence,event_type:'QUOTE_LIFECYCLE_V04'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:3,lifecycle:{stage:'zugesagt'}}});
 expect(await withSession(fixture,()=>updateQuoteAction({quoteId,clientEventId:randomUUID(),expectedVersion:3,dueDate:'2027-04-21',note:'TEST changed edition',positions:[{...position,lineTotalCents:1100}]}))).toMatchObject({code:'OK',quote:{version:4,lifecycle:{edition:2,acceptedEdition:1,stage:'geaendert_seit_versand'}}});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({...accepted,clientEventId:randomUUID(),expectedVersion:4}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:4,totalNetCents:1100,lifecycle:{edition:2,stage:'geaendert_seit_versand'}}});
 const rejected={action:'reject' as const,reason:'TEST Kunde hat Projekt abgesagt',quoteId,clientEventId:randomUUID(),expectedVersion:4,edition:2};
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(rejected))).toMatchObject({code:'OK',quote:{version:5,lifecycle:{stage:'abgesagt',declineReason:rejected.reason}}});
 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${rejected.clientEventId}::uuid AND event_type='QUOTE_LIFECYCLE_V04'`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:5,lifecycle:{stage:'abgesagt'}}});
});

it('KV-03 settings persist explicit nullable approaches with DB/event/view, without changing the shared hourly-rate truth',async()=>{
 const fixture=await createFixture();
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,updated_at) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST KV V04 settings',statement_timestamp())`;
 await sql`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by) VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},7500,1,${fixture.actorId}::uuid)`;
 const {readQuoteDefaultsAction}=await import('@/app/actions/quotes.actions');
 const {saveQuoteSettingsAction}=await import('@/app/actions/settings.actions');
 const initial=await withSession(fixture,()=>readQuoteDefaultsAction());
 expect(initial).toMatchObject({code:'OK',settings:{hourlyRateCents:7500,setupCents:null,materialCents:null,followupDays:null,validityDays:null}});
 if(initial.code!=='OK')throw Error('KV_SETTINGS_READ:'+initial.code);
 const input={clientEventId:randomUUID(),expectedUpdatedAt:initial.settings.updatedAt,setupCents:100,materialCents:200,followupDays:5,validityDays:30};
 expect(await withSession(fixture,()=>saveQuoteSettingsAction(input))).toMatchObject({code:'OK',settings:{hourlyRateCents:7500,setupCents:100,materialCents:200,followupDays:5,validityDays:30}});
 expect((await sql`SELECT c.kv_ruest_cents::text,c.kv_material_cents::text,c.kv_nachfass_tage,c.kv_gueltigkeit_tage,e.event_type FROM public.company_settings c JOIN public.events e ON e.tenant_id=c.tenant_id AND e.client_event_id=${input.clientEventId}::uuid WHERE c.tenant_id=${KREILE_TENANT_SLUG}`)[0]).toMatchObject({kv_ruest_cents:'100',kv_material_cents:'200',kv_nachfass_tage:5,kv_gueltigkeit_tage:30,event_type:'QUOTE_SETTINGS_UPDATED_V04'});
 expect(await withSession(fixture,()=>readQuoteDefaultsAction())).toMatchObject({code:'OK',settings:{hourlyRateCents:7500,setupCents:100,materialCents:200}});
 expect(await withSession(fixture,()=>saveQuoteSettingsAction(input))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>saveQuoteSettingsAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 const restricted=await createFixture(false);
 expect(await withSession(restricted,()=>saveQuoteSettingsAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect((await sql`SELECT count(*)::int n FROM private.extra_work_hourly_rates WHERE tenant_id=${KREILE_TENANT_SLUG}`)[0].n).toBe(1);
});

it('links one real captured KV source, preserves other concerns and rolls back a second quote for that source',async()=>{
 const fixture=await createFixture();
 const {saveIntakeNoteAction,getIntakeCaptureAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const {createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const itemId=randomUUID();
 const original=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Schmidt, 4 Weber-Trompeten verchromen, KV in zwei Wochen. Alte Halter bitte erhalten.',context:{customerId:fixture.customerId},concerns:['aufgabe']}));
 if(original.code!=='OK')throw Error('KV_SOURCE_CREATE:'+original.code);
 const chosen=await withSession(fixture,()=>selectIntakeConcernAction({itemId,version:original.capture.version,clientEventId:randomUUID(),concern:'kv_anfrage'}));
 if(chosen.code!=='OK')throw Error('KV_SOURCE_CONCERN:'+chosen.code);
 const input={clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST KV aus bestehender Erfassung',positions:[{name:'TEST Weber-Trompeten',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}],source:{itemId,version:chosen.capture.version,message:false},specialRequests:'Alte Halter bitte erhalten',deliveryWeeks:2};
 const created=await withSession(fixture,()=>createQuoteAction(input));
 expect(created).toMatchObject({code:'OK',quote:{lifecycle:{sourceItemId:itemId,sourceMessageId:null,specialRequests:input.specialRequests,deliveryWeeks:2}}});
 if(created.code!=='OK')throw Error('KV_SOURCE_QUOTE:'+created.code+':'+created.message);
 expect((await sql`SELECT source.vorgang_art,source.vorgang_id,source.einsatz,source.anliegen_offen,q.quelle_intake_item_id::text,q.sonderwuensche,q.lieferzeit_wochen FROM public.intake_item source JOIN private.quotes q ON q.tenant_id=source.tenant_id AND q.quelle_intake_item_id=source.id WHERE source.tenant_id=${KREILE_TENANT_SLUG} AND source.id=${itemId}::uuid`)[0]).toMatchObject({vorgang_art:'kv',vorgang_id:created.quote.quoteId,einsatz:'offen',anliegen_offen:['aufgabe'],quelle_intake_item_id:itemId,sonderwuensche:input.specialRequests,lieferzeit_wochen:2});
 expect((await sql`SELECT count(*)::int n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND nachher->>'action'='kv.angelegt'`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{sourceItemId:itemId}}});
 expect(await withSession(fixture,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>createQuoteAction(input))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>createQuoteAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect((await sql`SELECT count(*)::int n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(1);
});


it('KV-07b conditional response clears acceptance, creates no order and requires a newly sent edition',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,updateQuoteAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST Vorbehalt Halter',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1500};
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST KV Vorbehalt',positions:[position]}));
 if(created.code!=='OK')throw Error('TEST_CONDITIONAL_CREATE:'+created.code);
 const quoteId=created.quote.quoteId;
 const step=(action:'sent'|'accept'|'conditional',version:number,edition:number,evidence:string)=>withSession(fixture,()=>changeQuoteLifecycleAction({quoteId,clientEventId:randomUUID(),expectedVersion:version,edition,...(action==='sent'?{action,channel:'druck' as const,evidence}:{action,evidence})}));
 expect(await step('sent',1,1,'TEST ausgedruckt am Tresen')).toMatchObject({code:'OK'});
 expect(await step('accept',2,1,'TEST zuerst telefonisch zugesagt')).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{stage:'zugesagt'}}});
 expect((await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 const input={action:'conditional' as const,quoteId,clientEventId:randomUUID(),expectedVersion:3,edition:1,evidence:'TEST einverstanden, aber nicht zu diesem Preis'};
 const result=await withSession(fixture,()=>changeQuoteLifecycleAction(input));
 expect(result).toMatchObject({code:'OK',quote:{version:4,linkedOrderId:null,lifecycle:{stage:'versendet',acceptedEdition:null,acceptanceEvidence:null,conditional:{edition:1,reason:input.evidence}}}});
 const [stored]=await sql`SELECT q.vorbehalt_fassung,q.vorbehalt_grund,q.zugesagt_fassung,q.zugesagt_am,q.zusage_nachweis,e.event_type,e.payload->>'action' AS action FROM private.quotes q JOIN public.events e ON e.tenant_id=q.tenant_id AND e.client_event_id=${input.clientEventId}::uuid WHERE q.tenant_id=${KREILE_TENANT_SLUG} AND q.id=${quoteId}::uuid`;
 expect(stored).toMatchObject({vorbehalt_fassung:1,vorbehalt_grund:input.evidence,zugesagt_fassung:null,zugesagt_am:null,zusage_nachweis:null,event_type:'QUOTE_LIFECYCLE_V04',action:'conditional'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{acceptedEdition:null,conditional:{reason:input.evidence}}}});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(input))).toMatchObject({code:'OK',replayed:true});
 expect(await step('accept',4,1,'TEST versuchte alte Fassung trotz Vorbehalt')).toMatchObject({code:'VALIDATION_ERROR'});
 expect((await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 expect(await withSession(fixture,()=>updateQuoteAction({quoteId,clientEventId:randomUUID(),expectedVersion:4,dueDate:'2027-04-20',note:'TEST Preis nach Vorbehalt angepasst',positions:[{...position,unitPriceCents:1400}]}))).toMatchObject({code:'OK',quote:{version:5,lifecycle:{edition:2,stage:'geaendert_seit_versand'}}});
 expect(await step('accept',5,2,'TEST neue Fassung noch nicht gesendet')).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await step('sent',5,2,'TEST Fassung zwei ausgedruckt')).toMatchObject({code:'OK'});
 expect(await step('accept',6,2,'TEST Fassung zwei ohne Vorbehalt zugesagt')).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{edition:2,acceptedEdition:2,conditional:null,stage:'zugesagt'}}});
 expect((await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
});


it('KV-07 stores early goods once in the existing receipt, derives the lock and rereads the KV without an order',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST Ware vor Zusage',positions:[{name:'TEST Weber-Trompeten',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
 if(created.code!=='OK')throw Error('TEST_EARLY_GOODS_QUOTE:'+created.code);
 const quoteId=created.quote.quoteId,itemId=randomUUID();
 const capture=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Warenfotos zu bestehendem Vorgang',context:{customerId:fixture.customerId}}));
 if(capture.code!=='OK')throw Error('TEST_EARLY_GOODS_CAPTURE:'+capture.code);
 const photos=[{fileId:randomUUID(),kind:'uebersicht' as const},{fileId:randomUUID(),kind:'teile' as const}];
 // Isolated canonical original fixtures: this test verifies goods booking, not external Storage delivery.
 for(const [index,photo] of photos.entries()){
  const hash=(index?'b':'a').repeat(64);
  await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${photo.fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${photo.fileId},'foto',${'TEST-KV-Ware-'+index+'.jpg'},'image/jpeg',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},statement_timestamp(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${photo.fileId}::uuid,${fixture.actorId},${sql.json({fileId:photo.fileId,sha256:hash,bytes:32})})`;
 }
 const input={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId,quoteId,expectedQuoteVersion:1,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos,quantities:created.quote.positions.map(position=>({itemId:position.id,expected:4,received:null,confirmed:true,note:null})),location:'TEST Regal E1'};
 expect(await withSession(fixture,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'OK',receipt:{id:input.id,auftrag_id:null,kv_id:quoteId,lagerort:input.location,gesperrt:true}});
 expect((await sql`SELECT receipt.auftrag_id,receipt.kv_id::text,receipt.kv_fassung,receipt.lagerort,event.nachher->>'action' AS action FROM public.goods_receipt receipt JOIN public.intake_event event ON event.tenant_id=receipt.tenant_id AND event.item_id=receipt.item_id AND event.art='ware' AND event.befehl_id=${input.clientEventId}::uuid WHERE receipt.tenant_id=${KREILE_TENANT_SLUG} AND receipt.id=${input.id}::uuid`)[0]).toMatchObject({auftrag_id:null,kv_id:quoteId,kv_fassung:1,lagerort:input.location,action:'kv.ware_angenommen'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{goods:[{id:input.id,location:input.location,blocked:true,orderId:null}]}}});
 expect(await withSession(fixture,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>saveGoodsReceiptAction({...input,location:'TEST anderer Ort'}))).toMatchObject({code:'CONFLICT'});
 expect((await sql`SELECT count(*)::int AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`)[0].n).toBe(1);
 expect((await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST ausgedruckter KV'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,evidence:'TEST aktuelle Fassung ohne Vorbehalt angenommen'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{goods:[{id:input.id,blocked:false,orderId:null}]}}});
 expect((await sql`SELECT count(*)::int AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`)[0].n).toBe(1);
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:3,confirmedAward:true as const,confirmedOrderDueDate:'2027-04-20',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:input.id};
 expect(await withSession(fixture,()=>convertQuoteToOrderAction({...award,goodsReceiptId:undefined}))).toMatchObject({code:'VALIDATION_ERROR',message:`Auftrag entsteht mit dem Wareneingang · Ware zu KV ${created.quote.quoteNumber} annehmen`});
 // Change only this TEST fixture to exercise a late failure after the canonical order event.
 await sql`UPDATE public.goods_receipt SET mengen=jsonb_set(mengen,'{0,bestaetigt}','3'::jsonb) WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.id}::uuid`;
 const mismatch=await withSession(fixture,()=>convertQuoteToOrderAction(award));
 expect(mismatch).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Mengenabweichung')});
 expect((await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 expect((await sql`SELECT count(*)::int AS n FROM private.quote_conversion_requests WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid`)[0].n).toBe(0);
 expect((await sql`SELECT linked_order_id,version FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0]).toMatchObject({linked_order_id:null,version:3});
 await sql`UPDATE public.goods_receipt SET mengen=jsonb_set(mengen,'{0,bestaetigt}','4'::jsonb) WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.id}::uuid`;
 const converted=await withSession(fixture,()=>convertQuoteToOrderAction(award));
 expect(converted).toMatchObject({code:'OK',quote:{status:'converted',lifecycle:{stage:'umgewandelt'}},goodsReceipt:{receipt:{id:input.id,kv_id:quoteId}}});
 if(converted.code!=='OK')throw Error('TEST_GOODS_CONVERSION:'+converted.code+':'+converted.message);
 expect((await sql`SELECT receipt.auftrag_id,receipt.kv_id::text,orders.ware,orders.station,orders.geprueft FROM public.goods_receipt receipt JOIN public.orders orders ON orders.tenant_id=receipt.tenant_id AND orders.id=receipt.auftrag_id WHERE receipt.tenant_id=${KREILE_TENANT_SLUG} AND receipt.id=${input.id}::uuid`)[0]).toMatchObject({auftrag_id:converted.orderReceipt.orderId,kv_id:quoteId,ware:'da',station:'angenommen',geprueft:true});
 expect((await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${converted.orderReceipt.orderId} AND event_type IN ('ORDER_INTAKE_CREATED_V1','GOODS_RECEIPT_SAVED_V1')`)[0].n).toBe(2);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:converted.orderReceipt.orderId,lifecycle:{goods:[{id:input.id,orderId:converted.orderReceipt.orderId,blocked:false}]}}});
 expect(await withSession(fixture,()=>convertQuoteToOrderAction(award))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId:converted.orderReceipt.orderId}});
 expect((await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(1);
 expect((await sql`SELECT count(*)::int AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`)[0].n).toBe(1);

});


it('KV-06 books new goods and order atomically only after current acceptance, including failure and repeat',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST Ware vor Zusage',specialRequests:'TEST alte Halter erhalten',positions:[{name:'TEST Weber-Trompeten',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
 if(created.code!=='OK')throw Error('TEST_EARLY_GOODS_QUOTE:'+created.code);
 const quoteId=created.quote.quoteId,itemId=randomUUID();
 const capture=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Warenfotos zu bestehendem Vorgang',context:{customerId:fixture.customerId}}));
 if(capture.code!=='OK')throw Error('TEST_EARLY_GOODS_CAPTURE:'+capture.code);
 const photos=[{fileId:randomUUID(),kind:'uebersicht' as const},{fileId:randomUUID(),kind:'teile' as const}];
 // Isolated canonical original fixtures: this test verifies goods booking, not external Storage delivery.
 for(const [index,photo] of photos.entries()){
  const hash=(index?'b':'a').repeat(64);
  await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${photo.fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${photo.fileId},'foto',${'TEST-KV-Ware-'+index+'.jpg'},'image/jpeg',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},statement_timestamp(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${photo.fileId}::uuid,${fixture.actorId},${sql.json({fileId:photo.fileId,sha256:hash,bytes:32})})`;
 }
 const input={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId,quoteId,expectedQuoteVersion:3,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos,quantities:created.quote.positions.map(position=>({itemId:position.id,expected:4,received:null,confirmed:true,note:null})),location:'TEST Regal E1'};

 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST aktuelle Fassung gedruckt'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,evidence:'TEST aktuelle Fassung zugesagt, Ware folgt'}))).toMatchObject({code:'OK'});
 const current=await withSession(fixture,()=>readQuoteAction({quoteId}));if(current.code!=='OK')throw Error('TEST_CURRENT_GOODS_QUOTE');
 input.quantities=current.quote.positions.map(position=>({itemId:position.id,expected:position.quantity,received:null,confirmed:true,note:null}));
 expect((await sql`SELECT count(*)::int n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 expect(await withSession(fixture,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'VALIDATION_ERROR'});
 const quoteOriginal=randomUUID();
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,vorgang_art,vorgang_id,einsatz,text,anliegen,anliegen_offen) VALUES(${quoteOriginal}::uuid,${KREILE_TENANT_SLUG},${quoteOriginal},'notiz','rein','app',${fixture.actorId}::uuid,${fixture.customerId},'hand','kv',${quoteId},'offen','TEST Nachtrag bleibt erhalten',ARRAY['aufgabe'],ARRAY['aufgabe'])`;
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:3,confirmedAward:true as const,confirmedOrderDueDate:'2027-04-20',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:input.id};
 const missingPhoto={...input,photos:[{...photos[0],fileId:randomUUID()},photos[1]]};
 expect(await withSession(fixture,()=>convertQuoteToOrderAction(award,missingPhoto))).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Pflichtfoto')});
 expect((await sql`SELECT count(*)::int n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 expect((await sql`SELECT count(*)::int n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`)[0].n).toBe(0);
 expect((await sql`SELECT count(*)::int n FROM private.quote_conversion_requests WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid`)[0].n).toBe(0);
 const converted=await withSession(fixture,()=>convertQuoteToOrderAction(award,input));
 expect(converted).toMatchObject({code:'OK',quote:{status:'converted'},goodsReceipt:{receipt:{id:input.id,kv_id:quoteId,lagerort:input.location}}});
 if(converted.code!=='OK')throw Error('TEST_NEW_GOODS_CONVERSION:'+converted.code+':'+converted.message);
 expect((await sql`SELECT receipt.auftrag_id,receipt.kv_id::text,orders.ware,orders.geprueft,orders.station,source.vorgang_art,source.vorgang_id FROM public.goods_receipt receipt JOIN public.orders orders ON orders.tenant_id=receipt.tenant_id AND orders.id=receipt.auftrag_id JOIN public.intake_item source ON source.tenant_id=receipt.tenant_id AND source.id=receipt.item_id WHERE receipt.tenant_id=${KREILE_TENANT_SLUG} AND receipt.id=${input.id}::uuid`)[0]).toMatchObject({auftrag_id:converted.orderReceipt.orderId,kv_id:quoteId,ware:'da',geprueft:true,station:'angenommen',vorgang_art:'auftrag',vorgang_id:converted.orderReceipt.orderId});
 expect((await sql`SELECT vorgang_art,vorgang_id,text,anliegen_offen,einsatz FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteOriginal}::uuid`)[0]).toMatchObject({vorgang_art:'auftrag',vorgang_id:converted.orderReceipt.orderId,text:'TEST Nachtrag bleibt erhalten',anliegen_offen:['aufgabe'],einsatz:'offen'});
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 expect((await sql`SELECT freetext_original FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${converted.orderReceipt.orderId}`)[0].freetext_original).toContain('TEST alte Halter erhalten');
 expect(await withSession(fixture,()=>getLiveOrderCardAction({orderId:converted.orderReceipt.orderId}))).toMatchObject({code:'OK',data:{card:{commercialQuote:{quoteId,totalNetCents:4000,specialRequests:'TEST alte Halter erhalten',positions:[{quantity:4,lineTotalCents:4000}]}}}});
 expect((await sql`SELECT count(*)::int n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art='ware' AND befehl_id=${input.clientEventId}::uuid`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:converted.orderReceipt.orderId,lifecycle:{goods:[{id:input.id,blocked:false,orderId:converted.orderReceipt.orderId}]}}});
 expect(await withSession(fixture,()=>convertQuoteToOrderAction(award,input))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>convertQuoteToOrderAction(award,{...input,location:'TEST anderes Regal'}))).toMatchObject({code:'CONFLICT'});
 expect((await sql`SELECT count(*)::int n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`)[0].n).toBe(1);
 expect((await sql`SELECT count(*)::int n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(1);
});


it('KV-03 snapshots explicit configured calculations, preserves sent prices and versions a changed basis with equal total',async()=>{
 const fixture=await createFixture();
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,kv_ruest_cents,kv_material_cents,kv_nachfass_tage,kv_gueltigkeit_tage,updated_at) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST KV configured calculation',100,200,5,30,statement_timestamp() WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 await sql`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by) SELECT ${randomUUID()}::uuid,${KREILE_TENANT_SLUG},7500,1,${fixture.actorId}::uuid WHERE NOT EXISTS(SELECT 1 FROM private.extra_work_hourly_rates WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 const {readQuoteDefaultsAction,createQuoteAction,readQuoteAction,updateQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
 const {setExtraWorkHourlyRateAction}=await import('@/app/actions/orders.actions');
 const defaults=await withSession(fixture,()=>readQuoteDefaultsAction());
 expect(defaults).toMatchObject({code:'OK',settings:{hourlyRateCents:7500,setupCents:100,materialCents:200}});
 if(defaults.code!=='OK')throw Error('TEST_CALC_DEFAULTS');
 const calculation={hours:'8',hourlyRateCents:defaults.settings.hourlyRateCents,setupCents:defaults.settings.setupCents,materialCents:defaults.settings.materialCents};
 const input={clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',validUntil:'2027-05-20',note:'TEST calculated quote',positions:[{name:'TEST Halter kalkuliert',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:15075}],calculation};
 const created=await withSession(fixture,()=>createQuoteAction(input));
 expect(created).toMatchObject({code:'OK',quote:{totalNetCents:60300,validUntil:input.validUntil,intakeSource:null,termStatus:null,lifecycle:{calculation:{hourlyRateCents:7500,setupCents:100,materialCents:200}}}});
 if(created.code!=='OK')throw Error('TEST_CALC_CREATE:'+created.code+':'+created.message);
 const quoteId=created.quote.quoteId;
 expect((await sql`SELECT kalk_stunden::text,stundensatz_cents::text,ruest_cents::text,material_cents::text,total_net_cents::text FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0]).toMatchObject({kalk_stunden:'8.0000',stundensatz_cents:'7500',ruest_cents:'100',material_cents:'200',total_net_cents:'60300'});
 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_CALCULATION_V04' AND payload->>'requestKey'=${input.clientEventId}`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>createQuoteAction(input))).toMatchObject({code:'OK',replayed:true});
 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_CALCULATION_V04' AND payload->>'requestKey'=${input.clientEventId}`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST Kalkulation gedruckt'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,evidence:'TEST aktuelle Kalkulation angenommen'}))).toMatchObject({code:'OK'});
 const [rate]=await sql`SELECT version FROM private.extra_work_hourly_rates WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY version DESC LIMIT 1`;
 expect(await withSession(fixture,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:rate.version,hourlyRateCents:8000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>readQuoteDefaultsAction())).toMatchObject({code:'OK',settings:{hourlyRateCents:8000}});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{totalNetCents:60300,lifecycle:{calculation:{hourlyRateCents:7500},stage:'zugesagt'}}});
 expect(await withSession(fixture,()=>createQuoteAction({...input,clientEventId:randomUUID(),positions:[{...input.positions[0],unitPriceCents:16075}],calculation:{...calculation,hourlyRateCents:8000}}))).toMatchObject({code:'OK',quote:{totalNetCents:64300,lifecycle:{calculation:{hourlyRateCents:8000}}}});
 const edit={quoteId,clientEventId:randomUUID(),expectedVersion:3,dueDate:input.dueDate,note:input.note,positions:input.positions,calculation:{...calculation,hours:'4',hourlyRateCents:15000}};
 expect(await withSession(fixture,()=>updateQuoteAction(edit))).toMatchObject({code:'OK',quote:{version:4,totalNetCents:60300,lifecycle:{edition:2,acceptedEdition:1,stage:'geaendert_seit_versand',calculation:{hourlyRateCents:15000}}}});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:4,lifecycle:{edition:2}}});
 expect((await sql`SELECT payload->'after'->>'hours' AS hours,payload->>'edition' AS edition FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_CALCULATION_V04' AND payload->>'requestKey'=${edit.clientEventId}`)[0]).toMatchObject({hours:'4',edition:'2'});
 expect(await withSession(fixture,()=>updateQuoteAction(edit))).toMatchObject({code:'OK',replayed:true});
 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_CALCULATION_V04' AND payload->>'requestKey'=${edit.clientEventId}`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>createQuoteAction({...input,clientEventId:randomUUID(),calculation:{...calculation,hourlyRateCents:null}}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(fixture,()=>createQuoteAction({...input,clientEventId:randomUUID(),calculation:{...calculation,hours:'9'}}))).toMatchObject({code:'VALIDATION_ERROR'});
});


it('KV-06/07b/08 records reply decisions and exactly their concern in one transaction with readback',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,selectIntakeConcernAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 for(const action of ['accept','conditional','reject'] as const){
  const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST reply '+action,positions:[{name:'TEST Teil',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
  if(created.code!=='OK')throw Error('TEST_REPLY_QUOTE:'+created.code);
  const quoteId=created.quote.quoteId;
  expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST aktuelle Fassung ausgegeben'}))).toMatchObject({code:'OK'});
  const itemId=randomUUID(),capture=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Bitte andere offene Arbeit erledigen',context:{customerId:fixture.customerId},concerns:['aufgabe']}));
  if(capture.code!=='OK')throw Error('TEST_REPLY_CAPTURE:'+capture.code);
  const selected=await withSession(fixture,()=>selectIntakeConcernAction({itemId,version:capture.capture.version,clientEventId:randomUUID(),concern:action==='reject'?'kv_ablehnung':'kv_annahme'}));
  if(selected.code!=='OK')throw Error('TEST_REPLY_CONCERN:'+selected.code);
  const identity={quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,source:{itemId,version:selected.capture.version,message:false}};
  const input=action==='reject'?{...identity,action,reason:'TEST Vorhaben abgesagt'}:{...identity,action,evidence:action==='conditional'?'TEST einverstanden, aber Preis anpassen':'TEST aktuelle Fassung verbindlich angenommen'};
  expect(await withSession(fixture,()=>changeQuoteLifecycleAction({...input,source:{...input.source,version:input.source.version+1}}))).toMatchObject({code:'CONFLICT'});
  expect((await sql`SELECT version,zugesagt_fassung,abgesagt_am FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0]).toMatchObject({version:2,zugesagt_fassung:null,abgesagt_am:null});
  expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`)[0].n).toBe(0);
  const result=await withSession(fixture,()=>changeQuoteLifecycleAction(input));
  expect(result).toMatchObject({code:'OK',quote:{version:3,linkedOrderId:null,lifecycle:{stage:action==='accept'?'zugesagt':action==='reject'?'abgesagt':'versendet',acceptedEdition:action==='accept'?1:null}}});
  const concerns=action==='conditional'?['aufgabe','aenderung']:['aufgabe'];
  expect((await sql`SELECT vorgang_art,vorgang_id,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0]).toMatchObject({vorgang_art:'kv',vorgang_id:quoteId,einsatz:'offen',anliegen_offen:concerns});
  expect((await sql`SELECT e.event_type,e.payload->'source'->>'itemId' AS source,i.nachher->>'action' AS action FROM public.events e JOIN public.intake_event i ON i.tenant_id=e.tenant_id AND i.befehl_id=e.client_event_id AND i.art='anliegen' WHERE e.tenant_id=${KREILE_TENANT_SLUG} AND e.client_event_id=${input.clientEventId}::uuid`)[0]).toMatchObject({event_type:'QUOTE_LIFECYCLE_V04',source:itemId,action:action==='accept'?'kv.zugesagt':action==='reject'?'kv.abgesagt':'kv.anpassen'});
  expect(await withSession(fixture,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{usage:'offen',concerns:expect.arrayContaining(concerns),openConcerns:concerns}});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:3}});
  expect(await withSession(fixture,()=>changeQuoteLifecycleAction(input))).toMatchObject({code:'OK',replayed:true});
  expect((await sql`SELECT count(*)::int n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art='anliegen' AND befehl_id=${input.clientEventId}::uuid`)[0].n).toBe(1);
 }
 expect((await sql`SELECT count(*)::int n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
});


it('KV-09 uses one canonical follow-up task and a protected quote projection, with Today readback and completion evidence',async()=>{
 const fixture=await createFixture();
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,kv_nachfass_tage,updated_at) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST KV followup',5,statement_timestamp() WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,getQuoteFollowupsForTodayAction}=await import('@/app/actions/quotes.actions');
 const {getIntakeTaskAction,saveIntakeTaskAction}=await import('@/app/actions/eingang.actions');
 const {berlinCalendarDay}=await import('@/lib/domain/workingDays');
 const today=berlinCalendarDay(),clock=new Date(today+'T12:00:00Z');clock.setUTCDate(clock.getUTCDate()-1);const past=clock.toISOString().slice(0,10);
 const create=()=>withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',validUntil:'2027-05-20',note:'TEST KV Nachfassen',positions:[{name:'TEST Halter',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
 const created=await create();if(created.code!=='OK')throw Error('TEST_FOLLOWUP_QUOTE:'+created.code);const quoteId=created.quote.quoteId;
 const sent={action:'sent' as const,quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck' as const,evidence:'TEST KV-Nachfass Fassung gedruckt'};
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(sent))).toMatchObject({code:'OK',quote:{version:2,lifecycle:{followupAt:expect.any(String)}}});
 const [task]=await sql`SELECT id::text,faellig_am::text,client_key::text,bezug_typ,bezug_id,status,titel FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${quoteId}`;
 expect(task).toMatchObject({status:'offen',bezug_typ:'kv',bezug_id:quoteId,titel:expect.stringContaining(created.quote.quoteNumber)});expect(task.faellig_am>today).toBe(true);
 expect((await sql`SELECT nachfass_am::text FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0].nachfass_am).toBe(task.faellig_am);
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(sent))).toMatchObject({code:'OK',replayed:true});
 expect((await sql`SELECT count(*)::int n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${quoteId}`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>getQuoteFollowupsForTodayAction())).toMatchObject({code:'OK',tasks:[]});
 const editDue=async(taskId:string)=>{const read=await withSession(fixture,()=>getIntakeTaskAction({taskId}));if(read.code!=='OK'||!read.task)throw Error('TEST_FOLLOWUP_TASK_READ');const value=read.task;return withSession(fixture,()=>saveIntakeTaskAction({clientKey:value.client_key,taskId:value.id,version:value.version,kind:value.art,title:value.titel,dueDate:past,time:value.uhrzeit,forLogin:value.fuer_login,forArea:value.fuer_bereich,reference:{type:value.bezug_typ,id:value.bezug_id},note:value.notiz}));};
 expect(await editDue(task.id)).toMatchObject({code:'OK',task:{version:2,faellig_am:past}});
 expect((await sql`SELECT quote.nachfass_am::text,task.faellig_am::text FROM private.quotes quote JOIN public.tasks task ON task.tenant_id=quote.tenant_id AND task.bezug_id=quote.id::text WHERE quote.tenant_id=${KREILE_TENANT_SLUG} AND quote.id=${quoteId}::uuid`)[0]).toMatchObject({nachfass_am:past,faellig_am:past});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:2,lifecycle:{followupAt:past}}});
 expect(await withSession(fixture,()=>getQuoteFollowupsForTodayAction())).toMatchObject({code:'OK',tasks:[{id:task.id,dueDate:past,quoteId}]});
 const dashboard=()=>withSession(fixture,async()=>{const {resolveAuthorization}=await import('@/lib/server/authorization');const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_FOLLOWUP_AUTH');const {readTodayDashboard}=await import('@/lib/server/todayDashboard');const {getComplaints}=await import('@/app/actions/complaints.actions');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 expect((await dashboard()).items).toContainEqual(expect.objectContaining({key:'task:'+task.id,kind:'task',target:{screen:'aufgabe',arg:task.id}}));
 await expect(sql`UPDATE private.quotes SET nachfass_am='2040-01-01'::date WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`).rejects.toThrow('QUOTE_FOLLOWUP_REQUIRES_CANONICAL_TASK');
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,evidence:'TEST Kunde hat zugesagt'}))).toMatchObject({code:'OK',quote:{lifecycle:{stage:'zugesagt',followupAt:null}}});
 expect((await sql`SELECT status,version,erledigt_notiz FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${task.id}::uuid`)[0]).toMatchObject({status:'erledigt',version:3,erledigt_notiz:'KV zugesagt'});
 expect((await sql`SELECT count(*)::int n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND nachher->>'taskId'=${task.id} AND nachher->>'action'='aufgabe.erledigt'`)[0].n).toBe(1);
 expect((await dashboard()).items.some(item=>item.key==='task:'+task.id)).toBe(false);
 expect(await withSession(fixture,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'OK',task:{status:'erledigt'}});
 const expiring=await create();if(expiring.code!=='OK')throw Error('TEST_EXPIRING_QUOTE');const expiryId=expiring.quote.quoteId;
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({...sent,quoteId:expiryId,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const [expiryTask]=await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${expiryId}`;expect(await editDue(expiryTask.id)).toMatchObject({code:'OK'});
 // Only this new TEST fixture represents elapsed calendar time; no product decision is mocked.
 await sql`UPDATE private.quotes SET valid_until=${past}::date WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${expiryId}::uuid`;
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:expiryId}))).toMatchObject({code:'OK',quote:{lifecycle:{stage:'abgelaufen'}}});
 expect(await withSession(fixture,()=>getQuoteFollowupsForTodayAction())).toMatchObject({code:'OK',tasks:[]});
 expect((await sql`SELECT id::text,status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${expiryTask.id}::uuid`)[0]).toMatchObject({id:expiryTask.id,status:'offen'});
});


it('KV-01 prepares the saved original through real recognition and customer search, then creates one linked quote',async()=>{
 const fixture=await createFixture();
 // This isolated TEST customer name is deliberately the recognition target, not a product sample.
 await sql`UPDATE public.customers SET name='TEST Schmidt',company_name='TEST Schmidt',contact_person='Sabrina Schmidt' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
 const {saveIntakeNoteAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const {prepareQuoteFromIntakeAction,createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const itemId=randomUUID();
 const original=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'Schmidt, 4 Weber-Trompeten verchromen, KV, in zwei Wochen; Die alten Halter bitte erhalten.'}));
 if(original.code!=='OK')throw Error('TEST_PREPARE_SOURCE:'+original.code);
 const chosen=await withSession(fixture,()=>selectIntakeConcernAction({itemId,version:original.capture.version,clientEventId:randomUUID(),concern:'kv_anfrage'}));
 if(chosen.code!=='OK')throw Error('TEST_PREPARE_CONCERN:'+chosen.code);
 const prepared=await withSession(fixture,()=>prepareQuoteFromIntakeAction({sourceItemId:itemId}));
 expect(prepared).toMatchObject({code:'OK',preparation:{source:{itemId,version:chosen.capture.version,message:false},customer:null,proposals:[{id:fixture.customerId,name:'TEST Schmidt'}],recognition:{positions:[{name:'Weber-Trompeten',quantity:'4',surfaceRequested:'Verchromen'}],deliveryWeeks:{value:2}},specialRequests:'Die alten Halter bitte erhalten.'}});
 if(prepared.code!=='OK')throw Error('TEST_PREPARE_FAILED:'+prepared.code);
 expect((await sql`SELECT count(*)::int n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 const part=prepared.preparation.recognition.positions[0];
 const quote=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:prepared.preparation.text,source:prepared.preparation.source,specialRequests:prepared.preparation.specialRequests,deliveryWeeks:prepared.preparation.recognition.deliveryWeeks?.value,positions:[{name:part.name,quantity:Number(part.quantity),material:null,surfaceRequested:part.surfaceRequested,unitPriceCents:1000}]}));
 expect(quote).toMatchObject({code:'OK',quote:{lifecycle:{sourceItemId:itemId,specialRequests:'Die alten Halter bitte erhalten.',deliveryWeeks:2}}});
 if(quote.code!=='OK')throw Error('TEST_PREPARE_CREATE:'+quote.code);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:quote.quote.quoteId}))).toMatchObject({code:'OK',quote:{positions:[{name:'Weber-Trompeten',quantity:4}],lifecycle:{sourceItemId:itemId}}});
 expect((await sql`SELECT vorgang_art,vorgang_id,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0]).toMatchObject({vorgang_art:'kv',vorgang_id:quote.quote.quoteId,version:chosen.capture.version+1});
 expect((await sql`SELECT count(*)::int n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND nachher->>'action'='kv.angelegt'`)[0].n).toBe(1);
});


it('KV-02 prepares an existing TEST mail original with its file and active customer instruction, without another intake',async()=>{
 const fixture=await createFixture();
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${fixture.actorId}::uuid,'mails',${fixture.actorId}::uuid)`;
 const {saveIntakeNoteAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const {prepareQuoteFromIntakeAction,createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const itemId=randomUUID(),fileId=randomUUID(),agreementId=randomUUID();
 const original=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'KV bitte: 4 Stück Halter verchromen; die alten Halter bitte erhalten.',context:{customerId:fixture.customerId}}));
 if(original.code!=='OK')throw Error('TEST_MAIL_PREP_SOURCE:'+original.code);
 // Existing imported-mail precondition, synthetic and isolated: no Graph/Storage delivery is claimed here.
 await sql`UPDATE public.intake_item SET kanal='mail',richtung='rein',graph_message_id=${'TEST-kv-mail-'+itemId},absender_adresse='test-kv@example.invalid',betreff='TEST KV mit Originalfoto' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId}::uuid,'foto','TEST-Halter.jpg','image/jpeg',3,${'e'.repeat(64)},${KREILE_TENANT_SLUG+'/'+'e'.repeat(64)},statement_timestamp(),${fixture.actorId}::uuid,1,true,false,'fertig')`;
 await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${randomUUID()}::uuid,${fixture.actorId},${sql.json({fileId,sha256:'e'.repeat(64),syntheticFixture:true})}::jsonb)`;
 await sql`INSERT INTO public.customer_agreements(id,tenant_id,customer_id,position,bezeichnung,wert,hinweis,created_by) VALUES(${agreementId}::uuid,${KREILE_TENANT_SLUG},${fixture.customerId},1,'TEST Bearbeitung','Originalteile erhalten',true,${fixture.actorId}::uuid)`;
 const chosen=await withSession(fixture,()=>selectIntakeConcernAction({itemId,version:original.capture.version,clientEventId:randomUUID(),concern:'kv_anfrage'}));
 if(chosen.code!=='OK')throw Error('TEST_MAIL_PREP_CONCERN:'+chosen.code);
 const prepared=await withSession(fixture,()=>prepareQuoteFromIntakeAction({sourceItemId:itemId}));
 expect(prepared).toMatchObject({code:'OK',preparation:{source:{itemId,message:true},customer:{id:fixture.customerId},files:[{id:fileId,name:'TEST-Halter.jpg'}],confirmedCustomerHints:['TEST Bearbeitung: Originalteile erhalten'],specialRequests:expect.stringContaining('die alten Halter bitte erhalten')}});
 if(prepared.code!=='OK')throw Error('TEST_MAIL_PREPARE:'+prepared.code);
 const quote=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:prepared.preparation.text,source:prepared.preparation.source,specialRequests:prepared.preparation.specialRequests,positions:[{name:'TEST Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]}));
 if(quote.code!=='OK')throw Error('TEST_MAIL_PREP_CREATE:'+quote.code);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:quote.quote.quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{sourceMessageId:itemId,specialRequests:expect.stringContaining('Originalteile erhalten')}}});
 expect((await sql`SELECT source.vorgang_id,file.item_id::text FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${KREILE_TENANT_SLUG} AND file.id=${fileId}::uuid`)[0]).toEqual({vorgang_id:quote.quote.quoteId,item_id:itemId});
 expect((await sql`SELECT count(*)::int n FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${'TEST-kv-mail-'+itemId}`)[0].n).toBe(1);
});


it('KV-04 sends the real current PDF through the existing mail Action and marks only its persisted receipt, with no duplicate on retry',async()=>{
 const fixture=await createFixture();
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${fixture.actorId}::uuid,'mails',${fixture.actorId}::uuid)`;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST KV PDF' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 await sql`UPDATE public.company_settings SET company_name='TEST KV PDF',street='Pruefstrasse 18',zip='70173',city='Stuttgart',country='Deutschland',iban='DE02120300000000202051',bic='BYLADEM1001',bank_name='TEST Bank',tax_id='DE999999999',invoice_vat_rate_basis_points=1900,invoice_payment_term_days=14,kv_nachfass_tage=5 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const quote=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST PDF current edition',positions:[{name:'TEST Halter',quantity:3,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]}));
 if(quote.code!=='OK')throw Error('TEST_MAIL_QUOTE:'+quote.code);
 const envNames=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const;
 const previous=new Map(envNames.map(key=>[key,process.env[key]]));
 for(const key of envNames)process.env[key]=key==='MS_GRAPH_MAILBOX'?'test-kv@fixture.invalid':'TEST-kv-provider-only';
 const deliveries:Record<string,unknown>[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string|URL,init?:RequestInit)=>{
  if(String(url).startsWith('https://login.microsoftonline.com/'))return Response.json({access_token:'TEST-kv-provider-token-'+('x'.repeat(32))});
  if(String(url).startsWith('https://graph.microsoft.com/')&&String(url).endsWith('/sendMail')){deliveries.push(JSON.parse(String(init?.body)));return new Response('',{status:202});}
  throw Error('TEST_EXTERNAL_NETWORK_DENIED');
 }));
 try{
  const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
  const input={targetType:'CUSTOMER' as const,targetId:fixture.customerId,clientRequestId:randomUUID(),subject:'TEST KV verbindliche Fassung',body:'TEST Bitte aktuelle Fassung prüfen.',attachment:{kind:'QUOTE' as const,documentId:quote.quote.quoteId}};
  const sent=await withSession(fixture,()=>sendCustomerMailAction(input));
  expect(sent).toMatchObject({code:'OK'});if(sent.code!=='OK')throw Error('TEST_SEND:'+sent.code);
  expect(deliveries).toHaveLength(1);
  const payload=deliveries[0] as {message:{attachments:Array<{name:string;contentBytes:string}>}};
  expect(payload.message.attachments).toHaveLength(1);
  expect(Buffer.from(payload.message.attachments[0].contentBytes,'base64').subarray(0,4).toString()).toBe('%PDF');
  const events=await sql`SELECT event_type,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND (correlation_id=${input.clientRequestId}::uuid OR client_event_id=${input.clientRequestId}::uuid) ORDER BY created_at`;
  expect(events.map(event=>event.event_type)).toEqual(['COMMUNICATION_DOCUMENT_PREPARED_V1','COMMUNICATION_DOCUMENT_SENT_V1','QUOTE_LIFECYCLE_V04']);
  expect(events[0].payload.document).toMatchObject({id:quote.quote.quoteId,edition:1,version:1,sha256:expect.stringMatching(/^[0-9a-f]{64}$/)});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId:quote.quote.quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{sentEdition:1,sentChannel:'mail',stage:'versendet'}}});
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(deliveries).toHaveLength(1);
  expect(await withSession(fixture,()=>sendCustomerMailAction({...input,body:'TEST anderer Inhalt bei gleicher Kennung'}))).toMatchObject({code:'CONFLICT'});
  expect(deliveries).toHaveLength(1);
  expect((await sql`SELECT count(*)::int n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`)[0].n).toBe(1);
 }finally{vi.unstubAllGlobals();for(const key of envNames){const value=previous.get(key);if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

it('KV-04 reserves the PDF edition, preserves a real concurrent edit and never marks a failed send as sent',async()=>{
 const fixture=await createFixture();
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${fixture.actorId}::uuid,'mails',${fixture.actorId}::uuid)`;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST KV PDF' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 await sql`UPDATE public.company_settings SET company_name='TEST KV PDF',street='Pruefstrasse 18',zip='70173',city='Stuttgart',country='Deutschland',iban='DE02120300000000202051',bic='BYLADEM1001',bank_name='TEST Bank',tax_id='DE999999999',invoice_vat_rate_basis_points=1900,invoice_payment_term_days=14,kv_nachfass_tage=5 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const quote=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST PDF current edition',positions:[{name:'TEST Halter',quantity:3,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]}));
 if(quote.code!=='OK')throw Error('TEST_MAIL_QUOTE:'+quote.code);
 const envNames=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const;
 const previous=new Map(envNames.map(key=>[key,process.env[key]]));
 for(const key of envNames)process.env[key]=key==='MS_GRAPH_MAILBOX'?'test-kv@fixture.invalid':'TEST-kv-provider-only';
 const deliveries:Record<string,unknown>[]=[];let failDelivery=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string|URL,init?:RequestInit)=>{
  if(String(url).startsWith('https://login.microsoftonline.com/'))return Response.json({access_token:'TEST-kv-provider-token-'+('x'.repeat(32))});
  if(String(url).startsWith('https://graph.microsoft.com/')&&String(url).endsWith('/sendMail')){deliveries.push(JSON.parse(String(init?.body)));
   if(failDelivery)return Response.json({error:{code:'TEST_PROVIDER_UNAVAILABLE',message:'TEST unavailable'}},{status:503});
   const {updateQuoteAction}=await import('@/app/actions/quotes.actions');
   const updated=await withSession(fixture,()=>updateQuoteAction({quoteId:quote.quote.quoteId,clientEventId:randomUUID(),expectedVersion:1,dueDate:'2027-04-20',note:'TEST changed while mail is outside the database',positions:[{name:'TEST Halter',quantity:3,material:null,surfaceRequested:'Verchromen',unitPriceCents:2000}]}));
   expect(updated).toMatchObject({code:'OK',quote:{version:2,lifecycle:{edition:2,sentEdition:null}}});
   return new Response('',{status:202});}
  throw Error('TEST_EXTERNAL_NETWORK_DENIED');
 }));
 try{
  const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
  const input={targetType:'CUSTOMER' as const,targetId:fixture.customerId,clientRequestId:randomUUID(),subject:'TEST KV verbindliche Fassung',body:'TEST Bitte aktuelle Fassung prüfen.',attachment:{kind:'QUOTE' as const,documentId:quote.quote.quoteId}};
  const sent=await withSession(fixture,()=>sendCustomerMailAction(input));
  expect(sent).toMatchObject({code:'OK'});if(sent.code!=='OK')throw Error('TEST_SEND:'+sent.code);
  expect(deliveries).toHaveLength(1);
  const payload=deliveries[0] as {message:{attachments:Array<{name:string;contentBytes:string}>}};
  expect(payload.message.attachments).toHaveLength(1);
  expect(Buffer.from(payload.message.attachments[0].contentBytes,'base64').subarray(0,4).toString()).toBe('%PDF');
  expect(sent).toMatchObject({code:'OK',notice:expect.stringContaining('aktuelle Fassung 2 ist noch nicht versendet')});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId:quote.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:3,totalNetCents:6000,lifecycle:{edition:2,sentEdition:1,stage:'geaendert_seit_versand'}}});
  expect((await sql`SELECT count(*)::int n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${quote.quote.quoteId} AND status='offen'`)[0].n).toBe(0);
  const {changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
  expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId:quote.quote.quoteId,clientEventId:randomUUID(),expectedVersion:3,edition:2,evidence:'TEST keine Zusage zu ungesendeter neuer Fassung'}))).toMatchObject({code:'VALIDATION_ERROR'});
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(deliveries).toHaveLength(1);
  const second=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST failed mail',positions:[{name:'TEST anderer Halter',quantity:1,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]}));
  if(second.code!=='OK')throw Error('TEST_FAILED_MAIL_QUOTE:'+second.code);
  failDelivery=true;
  const failedInput={...input,clientRequestId:randomUUID(),attachment:{kind:'QUOTE' as const,documentId:second.quote.quoteId}};
  expect(await withSession(fixture,()=>sendCustomerMailAction(failedInput))).toMatchObject({code:'UNAVAILABLE'});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId:second.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:1,lifecycle:{sentEdition:null,stage:'entwurf'}}});
  expect(await withSession(fixture,()=>sendCustomerMailAction(failedInput))).toMatchObject({code:'CONFLICT'});
  expect(deliveries).toHaveLength(2);
  expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${failedInput.clientRequestId}::uuid AND event_type='COMMUNICATION_DOCUMENT_SENT_V1'`)[0].n).toBe(0);
 }finally{vi.unstubAllGlobals();for(const key of envNames){const value=previous.get(key);if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
