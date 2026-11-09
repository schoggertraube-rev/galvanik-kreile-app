// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash,randomUUID } from "node:crypto";
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
  role?:AppSession["role"];
  actorId: string;
  actorIssuedAt: number;
  customerId: string;
};

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const { AfterContext } = await import('next/dist/server/after/after-context');
  const deferred:Promise<unknown>[]=[];
  let onClose:()=>void=()=>{};
  const afterContext=new AfterContext({waitUntil:promise=>{deferred.push(promise);},onClose:callback=>{onClose=callback;},onTaskError:error=>{throw error;}});
  const request = new NextRequest("http://127.0.0.1/h18-quote-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-quote-actions",
    route: "/h18-quote-actions",
    afterContext,
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
  try{return await workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));}
  finally{onClose();await Promise.all(deferred);}
}

async function withSession<T>(fixture: Fixture, work: () => Promise<T>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId: fixture.actorId,
    tenantId: KREILE_TENANT_SLUG,
    role: fixture.role??"meister",
    displayName: "TEST KV V04",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(settings=true,areas=['eingang','auftraege','kunden','geld'],role:AppSession['role']='meister'): Promise<Fixture> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-quote-${actorId}@local.invalid`},
        'TEST KV V04', ${role}, true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${transaction.array([...areas,...(settings?['einstellungen']:[])])}::text[]) area
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
  return { actorId, actorIssuedAt, customerId,role };
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
 const forbiddenUpdate={quoteId,clientEventId:randomUUID(),expectedVersion:5,dueDate:'2027-04-22',note:'TEST unerlaubte Aenderung nach Absage',positions:[{...position,lineTotalCents:1200}]};
 expect(await withSession(fixture,()=>updateQuoteAction(forbiddenUpdate))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:5,totalNetCents:1100,lifecycle:{stage:'abgesagt',declineReason:rejected.reason}}});
 expect(await sql`SELECT id FROM private.quote_update_receipts WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${forbiddenUpdate.clientEventId}::uuid`).toHaveLength(0);
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


it.each([false,true])('KV-07 goods lock and real onsite acceptance without fictitious dispatch: %s',async(onsite)=>{
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
 if(!onsite)expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST ausgedruckter KV'}))).toMatchObject({code:'OK'});
 if(onsite)expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,evidence:'TEST unpassender Warenbeleg'},{onsiteGoodsReceiptId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:onsite?1:2,edition:1,evidence:'TEST aktuelle Fassung ohne Vorbehalt angenommen'},onsite?{onsiteGoodsReceiptId:input.id}:undefined))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{goods:[{id:input.id,blocked:false,orderId:null}]}}});
 expect((await sql`SELECT count(*)::int AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`)[0].n).toBe(1);
 if(onsite)expect((await sql`SELECT gesendet_fassung,zugesagt_fassung FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0]).toMatchObject({gesendet_fassung:null,zugesagt_fassung:1});
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:onsite?2:3,confirmedAward:true as const,confirmedOrderDueDate:'2027-04-20',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:input.id};
 expect(await withSession(fixture,()=>convertQuoteToOrderAction({...award,confirmedOrderDueDate:'2027-04-21'}))).toMatchObject({code:'VALIDATION_ERROR',message:'Auftragstermin muss dem aktuellen KV-Termin entsprechen.'});
 expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(0);
 expect(await sql`SELECT quote_id FROM private.quote_conversion_requests WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid`).toHaveLength(0);
 expect(await withSession(fixture,()=>convertQuoteToOrderAction({...award,goodsReceiptId:undefined}))).toMatchObject({code:'VALIDATION_ERROR',message:`Auftrag entsteht mit dem Wareneingang · Ware zu KV ${created.quote.quoteNumber} annehmen`});
 // Zero is not arrived goods. Positive deviation is separately covered by U246 cases.
 await sql`UPDATE public.goods_receipt SET mengen=jsonb_set(mengen,'{0,bestaetigt}','0'::jsonb) WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.id}::uuid`;
 const mismatch=await withSession(fixture,()=>convertQuoteToOrderAction(award));
 expect(mismatch).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Angenommene Menge')});
 expect((await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 expect((await sql`SELECT count(*)::int AS n FROM private.quote_conversion_requests WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid`)[0].n).toBe(0);
 expect((await sql`SELECT linked_order_id,version FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0]).toMatchObject({linked_order_id:null,version:onsite?2:3});
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


it.each([4,3,5])('KV-06 books actual quantity %i atomically, with proportional price, failure and repeat',async(receivedQuantity)=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST Ware vor Zusage',calculation:{hours:'4',hourlyRateCents:1000,setupCents:0,materialCents:0},specialRequests:'TEST alte Halter erhalten',positions:[{name:'TEST Weber-Trompeten',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
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
 const input={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId,quoteId,expectedQuoteVersion:3,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos,quantities:created.quote.positions.map(position=>({itemId:position.id,expected:4,received:receivedQuantity===4?null:receivedQuantity,confirmed:receivedQuantity===4,note:receivedQuantity===4?null:'TEST angenommene Menge weicht ab'})),location:'TEST Regal E1'};

 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST aktuelle Fassung gedruckt'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,evidence:'TEST aktuelle Fassung zugesagt, Ware folgt'}))).toMatchObject({code:'OK'});
 const current=await withSession(fixture,()=>readQuoteAction({quoteId}));if(current.code!=='OK')throw Error('TEST_CURRENT_GOODS_QUOTE');
 input.quantities=current.quote.positions.map(position=>({itemId:position.id,expected:position.quantity,received:receivedQuantity===4?null:receivedQuantity,confirmed:receivedQuantity===4,note:receivedQuantity===4?null:'TEST angenommene Menge weicht ab'}));
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
 expect(await withSession(fixture,()=>getLiveOrderCardAction({orderId:converted.orderReceipt.orderId}))).toMatchObject({code:'OK',data:{card:{commercialQuote:{quoteId,plannedHours:receivedQuantity+'.0000',totalNetCents:receivedQuantity*1000,specialRequests:'TEST alte Halter erhalten',positions:[{quantity:receivedQuantity,lineTotalCents:receivedQuantity*1000}]}}}});
 const {prepareQuoteCopyAction}=await import('@/app/actions/quotes.actions');
 const copy=await withSession(fixture,()=>prepareQuoteCopyAction({kind:'order',id:converted.orderReceipt.orderId,customerId:fixture.customerId}));
 expect(copy).toMatchObject({code:'OK',preparation:{source:{kind:'order',id:converted.orderReceipt.orderId},positions:[{quantity:receivedQuantity,lineTotalCents:receivedQuantity*1000}],specialRequests:'TEST alte Halter erhalten',comparison:{actualHours:null,orderId:converted.orderReceipt.orderId},missing:[]}});
 expect((await sql`SELECT quantity::float8 AS quantity FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${converted.orderReceipt.orderId}`)[0].quantity).toBe(receivedQuantity);
 expect((await sql`SELECT count(*)::int n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art='ware' AND befehl_id=${input.clientEventId}::uuid`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:converted.orderReceipt.orderId,lifecycle:{goods:[{id:input.id,blocked:false,orderId:converted.orderReceipt.orderId}]}}});
 expect(await withSession(fixture,()=>convertQuoteToOrderAction(award,input))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>convertQuoteToOrderAction(award,{...input,location:'TEST anderes Regal'}))).toMatchObject({code:'CONFLICT'});
 expect((await sql`SELECT count(*)::int n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`)[0].n).toBe(1);
 expect((await sql`SELECT count(*)::int n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(1);
});

it.each([3])('U246 price follow-up goods quantity %i keeps setup fixed and scales labour and material through the real writer',async(receivedQuantity)=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST Ware vor Zusage',calculation:{hours:'4',hourlyRateCents:1000,setupCents:1200,materialCents:900},specialRequests:'TEST alte Halter erhalten',positions:[{name:'TEST Weber-Trompeten',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1525}]}));
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
 const input={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId,quoteId,expectedQuoteVersion:3,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos,quantities:created.quote.positions.map(position=>({itemId:position.id,expected:4,received:receivedQuantity===4?null:receivedQuantity,confirmed:receivedQuantity===4,note:receivedQuantity===4?null:'TEST angenommene Menge weicht ab'})),location:'TEST Regal E1'};

 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST aktuelle Fassung gedruckt'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,evidence:'TEST aktuelle Fassung zugesagt, Ware folgt'}))).toMatchObject({code:'OK'});
 const current=await withSession(fixture,()=>readQuoteAction({quoteId}));if(current.code!=='OK')throw Error('TEST_CURRENT_GOODS_QUOTE');
 input.quantities=current.quote.positions.map(position=>({itemId:position.id,expected:position.quantity,received:receivedQuantity===4?null:receivedQuantity,confirmed:receivedQuantity===4,note:receivedQuantity===4?null:'TEST angenommene Menge weicht ab'}));
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
 expect(await withSession(fixture,()=>getLiveOrderCardAction({orderId:converted.orderReceipt.orderId}))).toMatchObject({code:'OK',data:{card:{commercialQuote:{quoteId,plannedHours:receivedQuantity+'.0000',totalNetCents:4875,specialRequests:'TEST alte Halter erhalten',positions:[{quantity:receivedQuantity,lineTotalCents:4875}]}}}});
 const {prepareQuoteCopyAction}=await import('@/app/actions/quotes.actions');
 const copy=await withSession(fixture,()=>prepareQuoteCopyAction({kind:'order',id:converted.orderReceipt.orderId,customerId:fixture.customerId}));
 expect(copy).toMatchObject({code:'OK',preparation:{source:{kind:'order',id:converted.orderReceipt.orderId},positions:[{quantity:receivedQuantity,lineTotalCents:4875}],specialRequests:'TEST alte Halter erhalten',comparison:{actualHours:null,orderId:converted.orderReceipt.orderId},missing:[]}});
 expect((await sql`SELECT quantity::float8 AS quantity FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${converted.orderReceipt.orderId}`)[0].quantity).toBe(receivedQuantity);
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


it.each([false,true])('KV-04 sends the real current PDF through the existing mail Action and marks only its persisted receipt, with no duplicate on retry; atomic mail order: %s',async(automatic)=>{
 const fixture=await createFixture();
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${fixture.actorId}::uuid,'mails',${fixture.actorId}::uuid)`;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST KV PDF' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 await sql`UPDATE public.company_settings SET company_name='TEST KV PDF',street='Pruefstrasse 18',zip='70173',city='Stuttgart',country='Deutschland',iban='DE02120300000000202051',bic='BYLADEM1001',bank_name='TEST Bank',tax_id='DE999999999',invoice_vat_rate_basis_points=1900,invoice_payment_term_days=14,kv_nachfass_tage=5 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const itemId=randomUUID(),fileId=randomUUID(),graphMessageId='TEST-source-KV-mail/'+randomUUID();
 const original=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST KV bitte fuer drei Halter verchromen.',context:{customerId:fixture.customerId}}));
 if(original.code!=='OK')throw Error('TEST_REPLY_SOURCE:'+original.code);
 // Isolated completed imported-mail DB precondition; no external import/delivery claim.
 await sql`UPDATE public.intake_item SET kanal='mail',richtung='rein',graph_message_id=${graphMessageId},absender_name='TEST Kunde',absender_adresse='test-kv@example.invalid',betreff='TEST Ursprungsanfrage',empfangen_am=statement_timestamp() WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 const fileHash='f'.repeat(64);
 await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'mime','TEST-Original.eml','message/rfc822',32,${fileHash},${KREILE_TENANT_SLUG+'/'+fileHash},statement_timestamp(),${fixture.actorId}::uuid,1,true,false,'fertig')`;
 await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${fileId}::uuid,${fixture.actorId},${sql.json({fileId,sha256:fileHash,bytes:32})})`;
 await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'einsatz',${randomUUID()}::uuid,${fixture.actorId},${sql.json({action:'mail_import_complete',fileIds:[fileId],originalCount:0,filteredAttachments:0})})`;
 const chosen=await withSession(fixture,()=>selectIntakeConcernAction({itemId,version:original.capture.version,clientEventId:randomUUID(),concern:'kv_anfrage'}));
 if(chosen.code!=='OK')throw Error('TEST_REPLY_CONCERN:'+chosen.code);
 const quote=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST PDF current edition',source:{itemId,version:chosen.capture.version,message:true},positions:[{name:'TEST Halter',quantity:3,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]}));
 if(quote.code!=='OK')throw Error('TEST_MAIL_QUOTE:'+quote.code);const createdQuoteId=quote.quote.quoteId;
 const envNames=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const;
 const previous=new Map(envNames.map(key=>[key,process.env[key]]));
 for(const key of envNames)process.env[key]=key==='MS_GRAPH_MAILBOX'?'test-kv@fixture.invalid':'TEST-kv-provider-only';
 const deliveries:Record<string,unknown>[]=[],endpoints:string[]=[];let proofReads=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string|URL,init?:RequestInit)=>{
  if(String(url).startsWith('https://login.microsoftonline.com/'))return Response.json({access_token:'TEST-kv-provider-token-'+('x'.repeat(32))});
  if(String(url).startsWith('https://graph.microsoft.com/')&&String(url).endsWith('/reply')){endpoints.push(String(url));deliveries.push(JSON.parse(String(init?.body)));return new Response('',{status:202});}
  if(String(url).includes('/mailFolders/sentitems/messages?')){proofReads++;const second=new URL(String(url)).searchParams.get('$filter')?.includes('edition2');return Response.json({value:[{id:second?'TEST-sent-2':'TEST-sent-1',internetMessageId:second?'<TEST-KV-edition2@fixture.invalid>':'<TEST-KV-edition1@fixture.invalid>',from:{emailAddress:{address:'test-kv@fixture.invalid'}},toRecipients:[{emailAddress:{address:'kv-'+fixture.customerId+'@local.invalid'}}],isDraft:false,sentDateTime:'2026-11-08T10:00:00Z',hasAttachments:true}]});}
  if(/\/messages\/TEST-sent-[12]\/attachments$/.test(String(url))){proofReads++;const index=String(url).includes('TEST-sent-2')?1:0;const delivered=deliveries[index] as {message:{attachments:Array<{name:string;contentType:string;contentBytes:string}>}};const file=delivered.message.attachments[0];return Response.json({value:[{...file,id:'TEST-actual-PDF-'+index,size:Buffer.from(file.contentBytes,'base64').length}]});}
  throw Error('TEST_EXTERNAL_NETWORK_DENIED');
 }));
 try{
  const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
  const input={targetType:'CUSTOMER' as const,targetId:fixture.customerId,clientRequestId:randomUUID(),subject:'TEST KV verbindliche Fassung',body:'TEST Bitte aktuelle Fassung prüfen.',attachment:{kind:'QUOTE' as const,documentId:quote.quote.quoteId}};
  const sent=await withSession(fixture,()=>sendCustomerMailAction(input));
  expect(sent).toMatchObject({code:'OK'});if(sent.code!=='OK')throw Error('TEST_SEND:'+sent.code);
  expect(deliveries).toHaveLength(1);
  expect(endpoints[0]).toContain('/messages/'+encodeURIComponent(graphMessageId)+'/reply');
  const payload=deliveries[0] as {message:{attachments:Array<{name:string;contentBytes:string}>}};
  expect(payload.message.attachments).toHaveLength(1);
  expect(Buffer.from(payload.message.attachments[0].contentBytes,'base64').subarray(0,4).toString()).toBe('%PDF');
  const events=await sql`SELECT event_type,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND (correlation_id=${input.clientRequestId}::uuid OR client_event_id=${input.clientRequestId}::uuid) ORDER BY created_at`;
  expect(events.map(event=>event.event_type)).toEqual(['COMMUNICATION_DOCUMENT_PREPARED_V1','COMMUNICATION_DOCUMENT_SENT_V1','QUOTE_LIFECYCLE_V04']);
  expect(events[0].payload.document).toMatchObject({id:quote.quote.quoteId,edition:1,version:1,sha256:expect.stringMatching(/^[0-9a-f]{64}$/),source:{itemId,graphMessageId}});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId:quote.quote.quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{sentEdition:1,sentChannel:'mail',stage:'versendet'}}});
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(deliveries).toHaveLength(1);
  expect(await withSession(fixture,()=>sendCustomerMailAction({...input,body:'TEST anderer Inhalt bei gleicher Kennung'}))).toMatchObject({code:'CONFLICT'});
  expect(deliveries).toHaveLength(1);
  expect((await sql`SELECT count(*)::int n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`)[0].n).toBe(1);
  // AF9: actual dispatch receipts and actual PDF bytes; only the remote provider is synthetic.
  const {updateQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
  expect(await withSession(fixture,()=>updateQuoteAction({quoteId:quote.quote.quoteId,clientEventId:randomUUID(),expectedVersion:2,dueDate:'2027-04-20',note:'TEST PDF edition two',positions:[{name:'TEST Halter',quantity:3,material:null,surfaceRequested:'Verchromen',unitPriceCents:1100}]}))).toMatchObject({code:'OK',quote:{version:3,lifecycle:{edition:2}}});
  expect(await withSession(fixture,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID(),subject:'TEST KV Fassung zwei'}))).toMatchObject({code:'OK'});
  expect(deliveries).toHaveLength(2);
  async function replySource(edition:number){
   const id=randomUUID(),mimeId=randomUUID(),ref='<TEST-KV-edition'+edition+'@fixture.invalid>',mime=Buffer.from('From: TEST customer\r\nIn-Reply-To: '+ref+'\r\n\r\nTEST Zusage');const hash=createHash('sha256').update(mime).digest('hex');
   await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,vorgang_art,vorgang_id,zuordnung,einsatz,text,anliegen,anliegen_offen,absender_adresse,graph_message_id) VALUES(${id}::uuid,${KREILE_TENANT_SLUG},${id},'mail','rein','mailabruf',${fixture.actorId}::uuid,${fixture.customerId},'kv',${createdQuoteId},'hand','offen','TEST Zusage',ARRAY['kv_annahme'],ARRAY['kv_annahme'],${'kv-'+fixture.customerId+'@local.invalid'},${'TEST-incoming-'+id})`;
   await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${mimeId}::uuid,${KREILE_TENANT_SLUG},${id}::uuid,${mimeId},'mime','TEST-AF9.eml','message/rfc822',${mime.length},${hash},${KREILE_TENANT_SLUG+'/'+hash},now(),${fixture.actorId}::uuid,1,true,false,'fertig')`;
   for(const [art,payload]of [['angelegt',{kanal:'mail',replyChain:{source:'original_mime',status:'present',originalSha256:hash,inReplyTo:[ref],references:[ref]}}],['original_gespeichert',{fileId:mimeId,sha256:hash,bytes:mime.length}],['einsatz',{action:'mail_import_complete',fileIds:[mimeId],originalCount:0,filteredAttachments:0}]] as const)await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${id}::uuid,${art},${randomUUID()}::uuid,${fixture.actorId},${sql.json(payload)})`;
   return {id,hash};
  }
  let goodsId:string|undefined;
  if(automatic){
   const {saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
   const latest=await withSession(fixture,()=>readQuoteAction({quoteId:createdQuoteId}));if(latest.code!=='OK')throw Error('TEST AF8 quote');
   const goodsSource=randomUUID(),capture=await withSession(fixture,()=>saveIntakeNoteAction({itemId:goodsSource,textstand:randomUUID(),text:'TEST AF8 bereits vorhandene Ware',context:{customerId:fixture.customerId}}));if(capture.code!=='OK')throw Error('TEST AF8 goods capture');
   const photos=[{fileId:randomUUID(),kind:'uebersicht' as const},{fileId:randomUUID(),kind:'teile' as const}];
   for(const [index,photo]of photos.entries()){
    const hash=(index?'b':'a').repeat(64);
    await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${photo.fileId}::uuid,${KREILE_TENANT_SLUG},${goodsSource}::uuid,${photo.fileId},'foto','TEST AF8.png','image/png',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},now(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
    await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${goodsSource}::uuid,'original_gespeichert',${photo.fileId}::uuid,${fixture.actorId},${sql.json({fileId:photo.fileId,sha256:hash,bytes:32})})`;
   }
   goodsId=randomUUID();expect(await withSession(fixture,()=>saveGoodsReceiptAction({id:goodsId,clientKey:randomUUID(),clientEventId:randomUUID(),itemId:goodsSource,quoteId:createdQuoteId,expectedQuoteVersion:4,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung',command:'accept',card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig',deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt',procedureNote:null,photos,quantities:latest.quote.positions.map(position=>({itemId:position.id,expected:position.quantity,received:null,confirmed:true,note:null})),location:'TEST AF8 Lager'}))).toMatchObject({code:'OK',receipt:{gesperrt:true}});
  }
  const oldReply=await replySource(1),oldKey=randomUUID();
  const oldAccept={action:'accept' as const,quoteId:quote.quote.quoteId,expectedVersion:4,edition:2,clientEventId:oldKey,evidence:'TEST Kunde sagt per alter Mail zu',source:{itemId:oldReply.id,version:1,message:true}};
  expect(await withSession(fixture,()=>changeQuoteLifecycleAction(oldAccept))).toMatchObject({code:'VALIDATION_ERROR',message:'Zusage galt Fassung 1 · Fassung 2 bestätigen lassen.'});
  expect((await sql`SELECT version,zugesagt_fassung FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${createdQuoteId}::uuid`)[0]).toMatchObject({version:4,zugesagt_fassung:null});
  expect((await sql`SELECT anliegen_offen,einsatz,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${oldReply.id}::uuid`)[0]).toMatchObject({anliegen_offen:['kv_annahme'],einsatz:'offen',version:1});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${oldKey}::uuid`).toHaveLength(0);
  const currentReply=await replySource(2),accept={...oldAccept,clientEventId:randomUUID(),source:{itemId:currentReply.id,version:1,message:true},evidence:'TEST aktuelle Fassung per Mail zugesagt'};
  if(automatic){
   expect(await withSession(fixture,()=>changeQuoteLifecycleAction(accept))).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Kundenkarte ergänzen')});
   expect((await sql`SELECT version,zugesagt_fassung FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${createdQuoteId}::uuid`)[0]).toMatchObject({version:4,zugesagt_fassung:null});
   // Isolated configuration/readiness fixtures; no production data or status is changed.
   await sql`UPDATE public.customers SET handover_preference='pickup',zip_code=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
   expect(await withSession(fixture,()=>changeQuoteLifecycleAction(accept))).toMatchObject({code:'VALIDATION_ERROR'});
   expect((await sql`SELECT version,zugesagt_fassung FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${createdQuoteId}::uuid`)[0]).toMatchObject({version:4,zugesagt_fassung:null});
   expect((await sql`SELECT version,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${currentReply.id}::uuid`)[0]).toMatchObject({version:1,anliegen_offen:['kv_annahme']});
   expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(0);
   expect(await sql`SELECT quote_id FROM private.quote_conversion_requests WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${createdQuoteId}::uuid`).toHaveLength(0);
   expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${accept.clientEventId}::uuid`).toHaveLength(0);
   await sql`UPDATE public.customers SET zip_code='70175' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
  }
  const acceptedResult=await withSession(fixture,()=>changeQuoteLifecycleAction(accept));
  expect(acceptedResult).toMatchObject({code:'OK',quote:{version:automatic?6:5,lifecycle:{acceptedEdition:2}}});
  if(automatic){
   if(acceptedResult.code!=='OK')throw Error('TEST AF8 conversion');
   expect(acceptedResult.quote.linkedOrderId).toEqual(expect.any(String));
   expect((await sql`SELECT auftrag_id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${goodsId!}::uuid`)[0].auftrag_id).toBe(acceptedResult.quote.linkedOrderId);
   expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(1);
   expect((await sql`SELECT handover_mode,payment_mode,ware,geprueft FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${acceptedResult.quote.linkedOrderId!}`)[0]).toMatchObject({handover_mode:'pickup',payment_mode:'rechnung',ware:'da',geprueft:true});
   expect((await sql`SELECT vorgang_art,vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${currentReply.id}::uuid`)[0]).toMatchObject({vorgang_art:'auftrag',vorgang_id:acceptedResult.quote.linkedOrderId});
  }
  const readCount=proofReads;
  expect(await withSession(fixture,()=>changeQuoteLifecycleAction(accept))).toMatchObject({code:'OK',replayed:true});expect(proofReads).toBe(readCount);
  const [accepted]=await sql`SELECT payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${accept.clientEventId}::uuid`;
  if(automatic)expect(accepted.payload.replyProof.automaticOrder).toBe(true);
  expect(accepted.payload.replyProof).toMatchObject({quoteId:quote.quote.quoteId,edition:2,originalSha256:currentReply.hash,inReplyTo:'<TEST-KV-edition2@fixture.invalid>',sentGraphId:'TEST-sent-2',sha256:expect.stringMatching(/^[0-9a-f]{64}$/)});
  expect((await sql`SELECT anliegen_offen,einsatz FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${currentReply.id}::uuid`)[0]).toMatchObject({anliegen_offen:[],einsatz:'erledigt'});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId:quote.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:automatic?6:5,lifecycle:{acceptedEdition:2}}});

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


it('KV-12 applies a mail term amendment to the existing quote and concern atomically, invalidates old acceptance and preserves the source',async()=>{
 const fixture=await createFixture();
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${fixture.actorId}::uuid,'mails',${fixture.actorId}::uuid)`;
 const {createQuoteAction,changeQuoteLifecycleAction,updateQuoteAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const positions=[{name:'TEST Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}];
 const quote=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2026-11-18',termStatus:'bestaetigt',note:'TEST Ursprungs-KV',positions}));
 if(quote.code!=='OK')throw Error('TEST_AMEND_QUOTE:'+quote.code);
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId:quote.quote.quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST Ursprung ausgegeben'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId:quote.quote.quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,evidence:'TEST ursprüngliche Fassung zugesagt'}))).toMatchObject({code:'OK'});
 const itemId=randomUUID(),text='Bitte Liefertermin auf 20.11.2026 ändern. TEST weitere Aufgabe erledigen.';
 const original=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text,context:{customerId:fixture.customerId}}));
 if(original.code!=='OK')throw Error('TEST_AMEND_SOURCE:'+original.code);
 // Existing imported TEST mail precondition; no external mail-import claim.
 await sql`UPDATE public.intake_item SET kanal='mail',richtung='rein',graph_message_id=${'TEST-amend-'+itemId},empfangen_am=statement_timestamp(),absender_name='TEST Kunde',absender_adresse='test-amend@example.invalid' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 const chosen=await withSession(fixture,()=>selectIntakeConcernAction({itemId,version:original.capture.version,clientEventId:randomUUID(),concern:'aenderung'}));
 if(chosen.code!=='OK')throw Error('TEST_AMEND_CONCERN:'+chosen.code);
 const input={quoteId:quote.quote.quoteId,clientEventId:randomUUID(),expectedVersion:3,dueDate:'2026-11-20',termStatus:'bestaetigt' as const,note:'TEST Ursprungs-KV',positions,source:{itemId,version:chosen.capture.version,message:true}};
 expect(await withSession(fixture,()=>updateQuoteAction({...input,source:{...input.source,version:input.source.version+1}}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:quote.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:3,dueDate:'2026-11-18',lifecycle:{edition:1,acceptedEdition:1}}});
 const updated=await withSession(fixture,()=>updateQuoteAction(input));
 expect(updated).toMatchObject({code:'OK',quote:{version:4,dueDate:'2026-11-20',termStatus:'bestaetigt',lifecycle:{edition:1,acceptedEdition:1,stage:'zugesagt'}}});
 expect(await withSession(fixture,()=>updateQuoteAction(input))).toMatchObject({code:'OK',replayed:true});
 const [row]=await sql`SELECT text,vorgang_art,vorgang_id,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 expect(row).toMatchObject({text,vorgang_art:'kv',vorgang_id:quote.quote.quoteId,anliegen_offen:expect.arrayContaining(['aufgabe'])});
 expect(row.anliegen_offen).not.toContain('aenderung');
 expect((await sql`SELECT count(*)::int n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND nachher->>'action'='kv.geaendert'`)[0].n).toBe(1);
 expect((await sql`SELECT count(*)::int n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(1);
 // Reuse the canonical new-goods command after the amended edition is really accepted.
 const quoteId=quote.quote.quoteId,goodsItem=randomUUID();
 const goodsCapture=await withSession(fixture,()=>saveIntakeNoteAction({itemId:goodsItem,textstand:randomUUID(),text:'TEST Ware zum geaenderten KV',context:{customerId:fixture.customerId}}));
 if(goodsCapture.code!=='OK')throw Error('TEST_AMEND_GOODS_CAPTURE:'+goodsCapture.code);
 const photos=[{fileId:randomUUID(),kind:'uebersicht' as const},{fileId:randomUUID(),kind:'teile' as const}];
 for(const [index,photo] of photos.entries()){
  const hash=(index?'d':'c').repeat(64);
  await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${photo.fileId}::uuid,${KREILE_TENANT_SLUG},${goodsItem}::uuid,${photo.fileId},'foto',${'TEST-Nachtrag-Ware-'+index+'.jpg'},'image/jpeg',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},statement_timestamp(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${goodsItem}::uuid,'original_gespeichert',${photo.fileId}::uuid,${fixture.actorId},${sql.json({fileId:photo.fileId,sha256:hash,bytes:32})})`;
 }
 const current=await withSession(fixture,()=>readQuoteAction({quoteId}));if(current.code!=='OK')throw Error('TEST_AMEND_CURRENT');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:goodsItem,quoteId,expectedQuoteVersion:4,sourceVersion:goodsCapture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos,quantities:current.quote.positions.map(position=>({itemId:position.id,expected:position.quantity,received:null,confirmed:true,note:null})),location:'TEST Nachtrag Regal'};
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:4,confirmedAward:true as const,confirmedOrderDueDate:'2026-11-20',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:goods.id};
 const converted=await withSession(fixture,()=>convertQuoteToOrderAction(award,goods));
 expect(converted).toMatchObject({code:'OK'});if(converted.code!=='OK')throw Error('TEST_AMEND_CONVERSION:'+converted.code+':'+converted.message);
 expect((await sql`SELECT due_date::date::text FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${converted.orderReceipt.orderId}`)[0]).toMatchObject({due_date:'2026-11-20'});
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const card=await withSession(fixture,()=>getLiveOrderCardAction({orderId:converted.orderReceipt.orderId}));
 expect(card).toMatchObject({code:'OK',data:{card:{dueAt:expect.stringContaining('2026-11-20')}}});
 expect((await withSession(fixture,()=>readQuoteAction({quoteId})))).toMatchObject({code:'OK',quote:{dueDate:'2026-11-20',linkedOrderId:converted.orderReceipt.orderId}});
 expect((await sql`SELECT vorgang_art,vorgang_id,text,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0]).toMatchObject({vorgang_art:'auftrag',vorgang_id:converted.orderReceipt.orderId,text,anliegen_offen:expect.arrayContaining(['aufgabe'])});
});

it('KV-11 copies exact existing quote contents through the sole create writer and keeps missing actual hours honest',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,prepareQuoteCopyAction,readQuoteAction,duplicateQuoteAction}=await import('@/app/actions/quotes.actions');
 const original=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2026-12-01',note:'TEST Kopiervorlage',specialRequests:'TEST alte Halter erhalten',positions:[{name:'TEST Halter',quantity:3,material:null,surfaceRequested:'verchromen',unitPriceCents:333,lineTotalCents:1000}]}));
 if(original.code!=='OK')throw Error('TEST_COPY_QUOTE:'+original.code);
 const prepared=await withSession(fixture,()=>prepareQuoteCopyAction({kind:'quote',id:original.quote.quoteId,customerId:fixture.customerId}));
 expect(prepared).toMatchObject({code:'OK',preparation:{source:{kind:'quote',id:original.quote.quoteId,version:1},customerId:fixture.customerId,positions:[{quantity:3,unitPriceCents:333,lineTotalCents:1000}],specialRequests:'TEST alte Halter erhalten',comparison:{actualHours:null,actualHoursReason:expect.stringContaining('fehlen')},missing:[]}});
 if(prepared.code!=='OK')throw Error('TEST_COPY_READ:'+prepared.code);
 expect((await sql`SELECT count(*)::int n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>prepareQuoteCopyAction({kind:'quote',id:original.quote.quoteId,customerId:'TEST-other-customer'}))).toMatchObject({code:'CONFLICT'});
 const input={kind:'quote' as const,id:original.quote.quoteId,expectedSourceVersion:1,clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2026-12-08'};
 const created=await withSession(fixture,()=>duplicateQuoteAction(input));
 expect(created).toMatchObject({code:'OK',quote:{totalNetCents:1000,dueDate:'2026-12-08',lifecycle:{edition:1,sentEdition:null,acceptedEdition:null,specialRequests:'TEST alte Halter erhalten'}}});
 if(created.code!=='OK')throw Error('TEST_COPY_CREATE:'+created.code);
 expect(created.quote.quoteId).not.toBe(original.quote.quoteId);
 expect(await withSession(fixture,()=>duplicateQuoteAction(input))).toMatchObject({code:'OK',replayed:true,quote:{quoteId:created.quote.quoteId}});
 expect((await sql`SELECT count(*)::int n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(2);
 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`)[0].n).toBe(1);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{totalNetCents:1000,positions:[{quantity:3,lineTotalCents:1000}]}});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:original.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:1,dueDate:'2026-12-01',totalNetCents:1000}});
});

it('U247 text proposal reuses real recognition and update, shows before/after and preserves acceptance for date only',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,prepareQuoteTextChangeAction,updateQuoteAction,readQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2026-11-20',note:'TEST Text-KV Original',positions:[{name:'TEST Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}],calculation:{hours:'4',hourlyRateCents:1000,setupCents:0,materialCents:0}}));
 if(created.code!=='OK')throw Error('TEST_TEXT_QUOTE:'+created.code);const quoteId=created.quote.quoteId;
 const apply=async(text:string)=>{
  const before=await withSession(fixture,()=>readQuoteAction({quoteId}));if(before.code!=='OK')throw Error('TEST_TEXT_BEFORE');
  const proposal=await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId,text}));
  expect(proposal,JSON.stringify(proposal)).toMatchObject({code:'OK',preparation:{canApply:true,before:{version:before.quote.version}}});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:before.quote.version}});
  if(proposal.code!=='OK'||!proposal.preparation.candidate)throw Error('TEST_TEXT_PROPOSAL');
  const result=await withSession(fixture,()=>updateQuoteAction({...proposal.preparation.candidate!,clientEventId:randomUUID()}));expect(result).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('TEST_TEXT_UPDATE:'+result.code);return result.quote;
 };
 expect(await apply('3 Halter statt 4')).toMatchObject({totalNetCents:3000,positions:[{quantity:3}],lifecycle:{calculation:{hours:'3.0000'}}});
 expect(await apply('noch 2 Halter dazu')).toMatchObject({totalNetCents:5000,positions:[{quantity:5}],lifecycle:{calculation:{hours:'5.0000'}}});
 expect(await apply('Arbeitszeit 8 Stunden')).toMatchObject({totalNetCents:8000,lifecycle:{calculation:{hours:'8.0000'}}});
 const priced=await apply('KV Preisziel 700 Euro');expect(priced).toMatchObject({totalNetCents:70000,lifecycle:{calculation:{hours:'70.0000'}}});
 const edition=priced.lifecycle!.edition;
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:priced.version,edition,channel:'druck',evidence:'TEST aktuelle Fassung ausgegeben'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:priced.version+1,edition,evidence:'TEST aktuelle Fassung zugesagt'}))).toMatchObject({code:'OK'});
 const dated=await apply('Termin 30.11.2026');expect(dated).toMatchObject({dueDate:'2026-11-30',note:'TEST Text-KV Original',lifecycle:{edition,acceptedEdition:edition,stage:'zugesagt'}});
 expect(await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId,text:'KV 999999999 auf 700 Euro'}))).toMatchObject({code:'CONFLICT'});
 for(const text of ['Arbeitszeit -8 Stunden','3 Halter statt 99','Arbeitszeit 8 Stunden, Preisziel 700 Euro'])expect(await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId,text}))).toMatchObject({code:'OK',preparation:{canApply:false,candidate:null}});
 const unknown=await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId,text:'3 Unbekannte statt 4'}));expect(unknown).toMatchObject({code:'OK',preparation:{canApply:false,candidate:null}});
 expect((await sql`SELECT version,fassung,zugesagt_fassung,due_date::date::text AS date FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0]).toMatchObject({version:dated.version,fassung:edition,zugesagt_fassung:edition,date:'2026-11-30'});

});

it('U246 price follow-up text uses fixed setup and proportional material matching actual goods',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,prepareQuoteTextChangeAction,updateQuoteAction,readQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2026-11-20',note:'TEST Text-KV Original',positions:[{name:'TEST Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1525}],calculation:{hours:'4',hourlyRateCents:1000,setupCents:1200,materialCents:900}}));
 if(created.code!=='OK')throw Error('TEST_TEXT_QUOTE:'+created.code);const quoteId=created.quote.quoteId;
 const apply=async(text:string)=>{
  const before=await withSession(fixture,()=>readQuoteAction({quoteId}));if(before.code!=='OK')throw Error('TEST_TEXT_BEFORE');
  const proposal=await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId,text}));
  expect(proposal,JSON.stringify(proposal)).toMatchObject({code:'OK',preparation:{canApply:true,before:{version:before.quote.version}}});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:before.quote.version}});
  if(proposal.code!=='OK'||!proposal.preparation.candidate)throw Error('TEST_TEXT_PROPOSAL');
  const result=await withSession(fixture,()=>updateQuoteAction({...proposal.preparation.candidate!,clientEventId:randomUUID()}));expect(result).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('TEST_TEXT_UPDATE:'+result.code);return result.quote;
 };
 expect(await apply('3 Halter statt 4')).toMatchObject({totalNetCents:4875,positions:[{quantity:3}],lifecycle:{calculation:{hours:'3.0000'}}});
 expect(await apply('noch 2 Halter dazu')).toMatchObject({totalNetCents:7325,positions:[{quantity:5}],lifecycle:{calculation:{hours:'5.0000'}}});
 expect(await apply('Arbeitszeit 8 Stunden')).toMatchObject({totalNetCents:10325,lifecycle:{calculation:{hours:'8.0000'}}});
 const priced=await apply('KV Preisziel 700 Euro');expect(priced).toMatchObject({totalNetCents:70000,lifecycle:{calculation:{hours:'67.6750'}}});
 const edition=priced.lifecycle!.edition;
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:priced.version,edition,channel:'druck',evidence:'TEST aktuelle Fassung ausgegeben'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:priced.version+1,edition,evidence:'TEST aktuelle Fassung zugesagt'}))).toMatchObject({code:'OK'});
 const dated=await apply('Termin 30.11.2026');expect(dated).toMatchObject({dueDate:'2026-11-30',note:'TEST Text-KV Original',lifecycle:{edition,acceptedEdition:edition,stage:'zugesagt'}});
 expect(await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId,text:'KV 999999999 auf 700 Euro'}))).toMatchObject({code:'CONFLICT'});
 for(const text of ['Arbeitszeit -8 Stunden','3 Halter statt 99','Arbeitszeit 8 Stunden, Preisziel 700 Euro'])expect(await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId,text}))).toMatchObject({code:'OK',preparation:{canApply:false,candidate:null}});
 const unknown=await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId,text:'3 Unbekannte statt 4'}));expect(unknown).toMatchObject({code:'OK',preparation:{canApply:false,candidate:null}});
 expect((await sql`SELECT version,fassung,zugesagt_fassung,due_date::date::text AS date FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0]).toMatchObject({version:dated.version,fassung:edition,zugesagt_fassung:edition,date:'2026-11-30'});

});
it.each([false,true])('U246 onsite request existing/new customer %s uses the real writers, retries and rejects changed intent',async(newCustomer)=>{
 const fixture=await createFixture();
 const {saveIntakeNoteAction}=await import('@/app/actions/eingang.actions');
 const {receiveOnsiteQuoteAction,getQuoteFollowupsForTodayAction}=await import('@/app/actions/quotes.actions');
 const itemId=randomUUID(),photoIds=[randomUUID(),randomUUID()];
 const captured=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Kunde vor Ort mit Ware, 3 Halter statt 4.'}));
 if(captured.code!=='OK')throw Error('TEST_ONSITE_SOURCE:'+captured.code);
 for(const [index,fileId]of photoIds.entries()){
  const hash=(index?'6':'7').repeat(64);
  await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'foto',${'TEST-onsite-'+index+'.jpg'},'image/jpeg',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},statement_timestamp(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${fileId}::uuid,${fixture.actorId},${sql.json({fileId,sha256:hash,bytes:32})})`;
 }
 const customer=newCustomer?{mode:'NEW' as const,data:{customerType:'privat' as const,firstName:'TEST',lastName:'VorOrt',phone:'061001234567',email:'test-onsite@example.invalid',street:'Testweg',houseNumber:'1',zipCode:'70173',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse'}}:{mode:'EXISTING' as const,customerId:fixture.customerId};
 const input={clientRequestId:randomUUID(),customer,quote:{dueDate:'2026-12-01',note:'TEST Vor-Ort-KV',positions:[{name:'TEST Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]},evidence:'TEST Kunde vor Ort bestaetigt Preis und Menge ohne Vorbehalt',goods:{itemId,sourceVersion:captured.capture.version,expectedVersion:0,mode:'erfassung',command:'accept',card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig',deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt',procedureNote:null,photos:photoIds.map((fileId,index)=>({fileId,kind:index?'teile':'uebersicht'})),location:'TEST Vor-Ort Regal'},quantities:[{position:1,received:3,note:'TEST drei tatsaechlich abgegeben'}],handoverMode:'pickup' as const,paymentMode:newCustomer?'vorkasse' as const:'rechnung' as const,confirmedOrderDueDate:'2026-12-01'};
 if(newCustomer){input.quote.positions.push({name:'TEST Fehlteil',quantity:2,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000});input.quantities.push({position:2,received:0,note:'TEST noch nicht geliefert'});}
 Object.assign(input.quote,{calculation:{hours:newCustomer?'6':'4',hourlyRateCents:1000,setupCents:0,materialCents:0}});
 const {saveIntakeDraftAction,getIntakeDraftsAction,discardIntakeDraftAction}=await import('@/app/actions/eingang.actions');
 const persisted=await withSession(fixture,()=>saveIntakeDraftAction({id:input.clientRequestId,clientEventId:randomUUID(),art:'eingang',payload:{kind:'package-onsite',version:1,clientKey:input.clientRequestId,sourceItemId:itemId,request:input},lastField:null,expectedVersion:null}));
 expect(persisted).toMatchObject({code:'OK',drafts:expect.arrayContaining([expect.objectContaining({id:input.clientRequestId,payload:expect.objectContaining({request:input})})])});
 const resumed=await withSession(fixture,()=>getIntakeDraftsAction());if(resumed.code!=='OK')throw Error('TEST_DRAFT_RESUME');const storedRequest=resumed.drafts.find(row=>row.id===input.clientRequestId)?.payload.request as typeof input;expect(storedRequest).toEqual(input);expect(JSON.stringify(storedRequest)).not.toBe(JSON.stringify(input));
 if(newCustomer){
  const bad={...storedRequest,quantities:storedRequest.quantities.map(row=>({...row,received:1,note:null}))};
  const rejected=await withSession(fixture,()=>receiveOnsiteQuoteAction(bad));expect(rejected).toMatchObject({code:'VALIDATION_ERROR',phase:'goods',progress:{quoteId:expect.any(String),customerId:expect.any(String)}});
  if(!('progress'in rejected)||!rejected.progress)throw Error('TEST partial progress');
  const {readOnsiteQuoteProgressAction}=await import('@/app/actions/quotes.actions');
  const eventsBefore=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${input.clientRequestId}::uuid ORDER BY id`;
  const actualPhase=await withSession(fixture,()=>readOnsiteQuoteProgressAction({requestId:input.clientRequestId,request:bad}));
  expect(actualPhase).toMatchObject({code:'OK',phases:{customer:true,quote:true,goods:false,order:false},progress:{quoteId:rejected.progress.quoteId,goodsBooked:false},facts:{customer:input.customer,quote:input.quote}});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${input.clientRequestId}::uuid ORDER BY id`).toEqual(eventsBefore);

  const currentDraft=resumed.drafts.find(row=>row.id===input.clientRequestId)!;
  expect(await withSession(fixture,()=>saveIntakeDraftAction({id:currentDraft.id,clientEventId:randomUUID(),art:'eingang',payload:{...currentDraft.payload,request:bad,progress:rejected.progress},lastField:null,expectedVersion:currentDraft.version}))).toMatchObject({code:'OK'});
  const restarted=await withSession(fixture,()=>getIntakeDraftsAction());if(restarted.code!=='OK')throw Error('TEST partial resume');const actual=restarted.drafts.find(row=>row.id===input.clientRequestId)!;
  expect(actual.payload.progress).toEqual(rejected.progress);Object.assign(storedRequest,actual.payload.request,{quantities:input.quantities});
  expect(await sql`SELECT id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${rejected.progress.customerId}`).toHaveLength(1);
 }
 if(newCustomer){const rejectedOrder=await withSession(fixture,()=>receiveOnsiteQuoteAction({...storedRequest,paymentMode:'rechnung'}));expect(rejectedOrder).toMatchObject({code:'VALIDATION_ERROR',progress:{goodsBooked:true}});}
 const received=await withSession(fixture,()=>receiveOnsiteQuoteAction(newCustomer?storedRequest:input));
 expect(received,JSON.stringify(received)).toMatchObject({code:'OK'});
 if(received.code!=='OK'||!('orderReceipt'in received))throw Error('TEST_ONSITE_ACTION:'+received.code+':'+('message'in received?received.message:''));
 const orderId=received.orderReceipt.orderId;
 const {readOnsiteQuoteProgressAction}=await import('@/app/actions/quotes.actions');
 const phaseRead=await withSession(fixture,()=>readOnsiteQuoteProgressAction({requestId:input.clientRequestId,request:input}));expect(phaseRead).toMatchObject({code:'OK',phases:{customer:true,quote:true,goods:true,order:true},progress:{quoteId:received.quote.quoteId,goodsBooked:true}});
 const phaseEvents=await sql`SELECT event_type,payload->>'phase' AS phase FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${input.clientRequestId}::uuid AND event_type='QUOTE_ONSITE_PHASE_V04' ORDER BY payload->>'phase'`;
 expect(phaseEvents.map(row=>row.phase)).toEqual(['customer','goods','order','quote']);

 if(newCustomer){expect(await sql`SELECT id FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${received.quote.customerId}`).toHaveLength(1);expect(await sql`SELECT id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${received.quote.customerId}`).toHaveLength(1);expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${received.quote.customerId}`).toHaveLength(1);}

 if(newCustomer){const {readQuoteAction}=await import('@/app/actions/quotes.actions');expect(await withSession(fixture,()=>readQuoteAction({quoteId:received.quote.quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{goods:[{expectedPositions:[{position:2,quantity:2}]}]}}});}

 expect(await withSession(fixture,()=>receiveOnsiteQuoteAction(newCustomer?input:storedRequest))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId}});
 expect(await withSession(fixture,()=>receiveOnsiteQuoteAction({...input,evidence:'TEST geaenderte Zusage'}))).toMatchObject({code:'CONFLICT'});
 expect((await sql`SELECT q.gesendet_fassung,q.zugesagt_fassung,q.linked_order_id,(SELECT quantity::float8 FROM public.items WHERE tenant_id=q.tenant_id AND order_id=q.linked_order_id) AS quantity FROM private.quotes q WHERE q.tenant_id=${KREILE_TENANT_SLUG} AND q.linked_order_id=${orderId}`)[0]).toMatchObject({gesendet_fassung:null,zugesagt_fassung:1,linked_order_id:orderId,quantity:3});
 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientRequestId}::uuid AND event_type='QUOTE_ONSITE_REQUESTED_V04'`)[0].n).toBe(1);
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(fixture,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{commercialQuote:{plannedHours:newCustomer?null:'3.0000',totalNetCents:3000,positions:[{quantity:3,lineTotalCents:3000}]}}}});
 expect(await withSession(fixture,()=>getQuoteFollowupsForTodayAction())).toMatchObject({code:'OK',tasks:[]});
 const finishDraft=await withSession(fixture,()=>getIntakeDraftsAction());if(finishDraft.code!=='OK')throw Error('TEST final draft');
 expect(await withSession(fixture,()=>discardIntakeDraftAction({id:input.clientRequestId,clientEventId:randomUUID(),reason:'TEST Auftrag erfolgreich übernommen',expectedVersion:finishDraft.drafts.find(row=>row.id===input.clientRequestId)!.version}))).toMatchObject({code:'OK'});
 expect(await sql`SELECT payload->>'reason' AS reason FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='INTAKE_DRAFT_DISCARDED_V1' AND payload->>'draftId'=${input.clientRequestId} AND user_id=${fixture.actorId}::uuid`).toEqual([{reason:'TEST Auftrag erfolgreich übernommen'}]);
 const remaining=await withSession(fixture,()=>getIntakeDraftsAction());if(remaining.code!=='OK')throw Error('TEST_ONSITE_DRAFT_READ');expect(remaining.drafts.some(row=>row.id===input.clientRequestId)).toBe(false);

});

it('U246 multi-position price uses the same text and goods proposal without invented hours',async()=>{
 const newCustomer=true;
 const fixture=await createFixture();
 const {saveIntakeNoteAction}=await import('@/app/actions/eingang.actions');
 const {receiveOnsiteQuoteAction,getQuoteFollowupsForTodayAction}=await import('@/app/actions/quotes.actions');
 const itemId=randomUUID(),photoIds=[randomUUID(),randomUUID()];
 const captured=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Kunde vor Ort mit Ware, 3 Halter statt 4.'}));
 if(captured.code!=='OK')throw Error('TEST_ONSITE_SOURCE:'+captured.code);
 for(const [index,fileId]of photoIds.entries()){
  const hash=(index?'6':'7').repeat(64);
  await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'foto',${'TEST-onsite-'+index+'.jpg'},'image/jpeg',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},statement_timestamp(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${fileId}::uuid,${fixture.actorId},${sql.json({fileId,sha256:hash,bytes:32})})`;
 }
 const customer=newCustomer?{mode:'NEW' as const,data:{customerType:'privat' as const,firstName:'TEST',lastName:'VorOrt',phone:'061001234567',email:'test-onsite@example.invalid',street:'Testweg',houseNumber:'1',zipCode:'70173',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse'}}:{mode:'EXISTING' as const,customerId:fixture.customerId};
 const input={clientRequestId:randomUUID(),customer,quote:{dueDate:'2026-12-01',note:'TEST Vor-Ort-KV',positions:[{name:'TEST Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]},evidence:'TEST Kunde vor Ort bestaetigt Preis und Menge ohne Vorbehalt',goods:{itemId,sourceVersion:captured.capture.version,expectedVersion:0,mode:'erfassung',command:'accept',card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig',deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt',procedureNote:null,photos:photoIds.map((fileId,index)=>({fileId,kind:index?'teile':'uebersicht'})),location:'TEST Vor-Ort Regal'},quantities:[{position:1,received:3,note:'TEST drei tatsaechlich abgegeben'}],handoverMode:'pickup' as const,paymentMode:newCustomer?'vorkasse' as const:'rechnung' as const,confirmedOrderDueDate:'2026-12-01'};
 if(newCustomer){input.quote.positions.push({name:'TEST Fehlteil',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:500});input.quantities.push({position:2,received:4,note:'TEST vollstaendig geliefert'});}
 Object.assign(input.quote,{calculation:{hours:'4',hourlyRateCents:1000,setupCents:1200,materialCents:800}});
 const received=await withSession(fixture,()=>receiveOnsiteQuoteAction(input));
 expect(received,JSON.stringify(received)).toMatchObject({code:'OK'});
 if(received.code!=='OK'||!('orderReceipt'in received))throw Error('TEST_ONSITE_ACTION:'+received.code+':'+('message'in received?received.message:''));
 const orderId=received.orderReceipt.orderId;
 if(newCustomer){const {readQuoteAction}=await import('@/app/actions/quotes.actions');expect(await withSession(fixture,()=>readQuoteAction({quoteId:received.quote.quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{goods:[{expectedPositions:[]}]}}});}

 expect(await withSession(fixture,()=>receiveOnsiteQuoteAction(input))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId}});
 expect(await withSession(fixture,()=>receiveOnsiteQuoteAction({...input,evidence:'TEST geaenderte Zusage'}))).toMatchObject({code:'CONFLICT'});
 expect((await sql`SELECT q.gesendet_fassung,q.zugesagt_fassung,q.linked_order_id,(SELECT quantity::float8 FROM public.items WHERE tenant_id=q.tenant_id AND order_id=q.linked_order_id AND name='TEST Halter') AS quantity FROM private.quotes q WHERE q.tenant_id=${KREILE_TENANT_SLUG} AND q.linked_order_id=${orderId}`)[0]).toMatchObject({gesendet_fassung:null,zugesagt_fassung:1,linked_order_id:orderId,quantity:3});
 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientRequestId}::uuid AND event_type='QUOTE_ONSITE_REQUESTED_V04'`)[0].n).toBe(1);
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(fixture,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{commercialQuote:{plannedHours:newCustomer?null:'3.0000',totalNetCents:5200,positions:[{quantity:3,lineTotalCents:3200},{quantity:4,lineTotalCents:2000}]}}}});
 expect(await withSession(fixture,()=>getQuoteFollowupsForTodayAction())).toMatchObject({code:'OK',tasks:[]});
  expect(await sql`SELECT name,quantity::float8 AS quantity FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} ORDER BY name`).toEqual([{name:'TEST Fehlteil',quantity:4},{name:'TEST Halter',quantity:3}]);
  const {createQuoteAction,prepareQuoteTextChangeAction}=await import('@/app/actions/quotes.actions');
  const quote=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2026-12-01',note:'TEST gleicher Mehrpositions-Textpreis',calculation:{hours:'4',hourlyRateCents:1000,setupCents:1200,materialCents:800},positions:[{name:'TEST Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000},{name:'TEST Fehlteil',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:500}]}));
  if(quote.code!=='OK')throw Error('TEST_MULTI_TEXT_QUOTE:'+quote.code);
  expect(await withSession(fixture,()=>prepareQuoteTextChangeAction({quoteId:quote.quote.quoteId,text:'3 Halter statt 4'}))).toMatchObject({code:'OK',preparation:{canApply:false,candidate:null,after:{totalNetCents:5200,calculation:null,positions:[{quantity:3,lineTotalCents:3200},{quantity:4,lineTotalCents:2000}]}}});

});
it('AF-3: validity extension rescues an expired quote without a new content edition and keeps accepted evidence',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const [dates]=await sql<{past:string;future:string;later:string;due:string}[]>`SELECT (current_date-1)::text AS past,(current_date+30)::text AS future,(current_date+60)::text AS later,(current_date+14)::text AS due`;
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:dates.due,validUntil:dates.past,note:'TEST AF3 abgelaufener KV',positions:[{name:'TEST AF3 Halter',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
 expect(created).toMatchObject({code:'OK',quote:{lifecycle:{stage:'abgelaufen',edition:1}}});if(created.code!=='OK')throw Error('AF3_CREATE_FAILED');
 const input={action:'extend' as const,quoteId:created.quote.quoteId,expectedVersion:1,edition:1,clientEventId:randomUUID(),validUntil:dates.future,evidence:'TEST Kunde erbittet eine neue Entscheidungsfrist'};
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(input))).toMatchObject({code:'OK',quote:{version:2,validUntil:dates.future,totalNetCents:1000,lifecycle:{edition:1,stage:'entwurf'}}});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction(input))).toMatchObject({code:'OK',replayed:true,quote:{version:2}});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({...input,validUntil:dates.later}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({...input,expectedVersion:2,clientEventId:randomUUID(),validUntil:dates.past}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({quoteId:input.quoteId,expectedVersion:2,edition:1,clientEventId:randomUUID(),action:'sent',channel:'druck',evidence:'TEST verlaengerten KV ausgedruckt'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({quoteId:input.quoteId,expectedVersion:3,edition:1,clientEventId:randomUUID(),action:'accept',evidence:'TEST aktuelle unveraenderte Fassung zugesagt'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({...input,expectedVersion:4,clientEventId:randomUUID(),validUntil:dates.later}))).toMatchObject({code:'OK',quote:{version:5,validUntil:dates.later,lifecycle:{edition:1,acceptedEdition:1,acceptanceEvidence:'TEST aktuelle unveraenderte Fassung zugesagt'}}});
 const events=await sql`SELECT user_id::text,payload->>'validUntil' AS valid_until FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND payload->>'quoteId'=${input.quoteId} AND event_type='QUOTE_LIFECYCLE_V04' AND payload->>'action'='extend' ORDER BY created_at`;
 expect(events).toEqual([{user_id:fixture.actorId,valid_until:dates.future},{user_id:fixture.actorId,valid_until:dates.later}]);
 expect(await withSession(fixture,()=>readQuoteAction({quoteId:input.quoteId}))).toMatchObject({code:'OK',quote:{version:5,validUntil:dates.later,totalNetCents:1000,linkedOrderId:null,lifecycle:{edition:1,acceptedEdition:1}}});
 const next=new Date(dates.later+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+30);const later=next.toISOString().slice(0,10);next.setUTCDate(next.getUTCDate()+30);
 const competing=await Promise.all([later,next.toISOString().slice(0,10)].map(validUntil=>withSession(fixture,()=>changeQuoteLifecycleAction({...input,expectedVersion:5,clientEventId:randomUUID(),validUntil}))));
 expect(competing.map(row=>row.code).sort()).toEqual(['CONFLICT','OK']);
 expect((await sql`SELECT version,fassung,zugesagt_fassung FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.quoteId}::uuid`)[0]).toMatchObject({version:6,fassung:1,zugesagt_fassung:1});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND payload->>'quoteId'=${input.quoteId} AND event_type='QUOTE_LIFECYCLE_V04' AND payload->>'action'='extend'`).toHaveLength(3);
});
it.each([false,true])('AF-4/13: return declined KV goods with one real actor receipt, including goods arriving after decline: %s',async(afterDecline)=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,saveGoodsReceiptAction,recordQuoteGoodsReturnAction,getQuoteGoodsReturnsAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST AF4 Rueckgabe',positions:[{name:'TEST AF4 Halter',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
 if(created.code!=='OK')throw Error('AF4_CREATE_FAILED');const quoteId=created.quote.quoteId;
 const decline=()=>withSession(fixture,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,clientEventId:randomUUID(),action:'reject',reason:'TEST kein Beschichtungsauftrag gewuenscht'}));
 if(afterDecline)expect(await decline()).toMatchObject({code:'OK'});
 const itemId=randomUUID(),capture=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST AF4 Warenoriginale',context:{customerId:fixture.customerId}}));if(capture.code!=='OK')throw Error('AF4_CAPTURE_FAILED');
 const photos=[{fileId:randomUUID(),kind:'uebersicht' as const},{fileId:randomUUID(),kind:'teile' as const}];
 // Canonical synthetic photo metadata: no external Storage delivery is claimed.
 for(const [index,photo]of photos.entries()){
  const hash=(index?'b':'a').repeat(64);
  await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${photo.fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${photo.fileId},'foto',${'TEST-AF4-'+index+'.jpg'},'image/jpeg',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},statement_timestamp(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${photo.fileId}::uuid,${fixture.actorId},${sql.json({fileId:photo.fileId})})`;
 }
 const current=await withSession(fixture,()=>readQuoteAction({quoteId}));if(current.code!=='OK')throw Error('AF4_READ_FAILED');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId,quoteId,expectedQuoteVersion:afterDecline?2:1,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos,quantities:current.quote.positions.map(p=>({itemId:p.id,expected:4,received:null,confirmed:true,note:null})),location:'TEST AF4 Rueckgaberegal'};
 expect(await withSession(fixture,()=>saveGoodsReceiptAction(goods))).toMatchObject({code:'OK',receipt:{id:goods.id,gesperrt:true,auftrag_id:null}});
 const worker={...fixture,actorId:randomUUID(),actorIssuedAt:Date.now()};
 await sql`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,created_at,updated_at) VALUES(${worker.actorId}::uuid,${KREILE_TENANT_SLUG},${worker.actorId+'@fixture.invalid'},'TEST AF4 ohne Bereichsrechte','meister',true,statement_timestamp()-interval '5 seconds',statement_timestamp()-interval '5 seconds')`;
 const input={quoteId,receiptId:goods.id,expectedQuoteVersion:2,expectedVersion:1,clientEventId:randomUUID(),reason:'TEST Ware an den Kunden zurueckgegeben'};
 if(!afterDecline){expect(await withSession(worker,()=>recordQuoteGoodsReturnAction({...input,expectedQuoteVersion:1}))).toMatchObject({code:'CONFLICT'});expect(await decline()).toMatchObject({code:'OK'});}
 const returned=await withSession(worker,()=>recordQuoteGoodsReturnAction(input));
 expect(returned).toMatchObject({code:'OK',replayed:false,receipt:{receiptId:goods.id,quoteId,customerId:fixture.customerId,actorId:worker.actorId,quantity:4,reason:input.reason,location:goods.location}});
 expect(await withSession(worker,()=>recordQuoteGoodsReturnAction(input))).toEqual({...returned,replayed:true});
 expect(await withSession(worker,()=>recordQuoteGoodsReturnAction({...input,reason:'TEST anderer Grund'}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(worker,()=>recordQuoteGoodsReturnAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(worker,()=>getQuoteGoodsReturnsAction(quoteId))).toMatchObject({code:'OK',receipts:[expect.objectContaining({receiptId:goods.id,actorId:worker.actorId})]});
 expect(await withSession(worker,()=>readQuoteAction({quoteId}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{stage:'abgesagt',goods:[]}}});
 expect((await sql`SELECT status,version,auftrag_id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${goods.id}::uuid`)[0]).toMatchObject({status:'angenommen',version:2,auftrag_id:null});
 expect(await sql`SELECT von FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND nachher->>'action'='kv.ware_zurueckgegeben'`).toEqual([{von:worker.actorId}]);
 expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid`).toHaveLength(2);
 expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(0);
});

it('U249: a login without area rights extends and accepts through the same writer without receiving money data',async()=>{
 const owner=await createFixture(),operator=await createFixture(false,[]);
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,updated_at) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST U249 settings',statement_timestamp() WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 const {readQuoteDefaultsAction}=await import('@/app/actions/quotes.actions');const {saveQuoteSettingsAction}=await import('@/app/actions/settings.actions');
 const settings=await withSession(owner,()=>readQuoteDefaultsAction());if(settings.code!=='OK')throw Error('TEST U249 settings');
 expect(await withSession(owner,()=>saveQuoteSettingsAction({clientEventId:randomUUID(),expectedUpdatedAt:settings.settings.updatedAt,setupCents:settings.settings.setupCents,materialCents:settings.settings.materialCents,followupDays:5,validityDays:settings.settings.validityDays}))).toMatchObject({code:'OK'});
 const [dates]=await sql<{past:string;future:string;later:string;due:string}[]>`SELECT (current_date-1)::text AS past,(current_date+30)::text AS future,(current_date+60)::text AS later,(current_date+14)::text AS due`;
 const quote=await withSession(owner,()=>createQuoteAction({clientEventId:randomUUID(),customerId:owner.customerId,dueDate:dates.due,validUntil:dates.future,note:'TEST U249 keine Geldfreigabe',positions:[{name:'TEST Halter',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:1234}]}));
 if(quote.code!=='OK')throw Error('TEST U249 quote');
 expect(await withSession(owner,()=>changeQuoteLifecycleAction({action:'sent',quoteId:quote.quote.quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST bestehende Fassung ausgedruckt'}))).toMatchObject({code:'OK'});
 const [task]=await sql`SELECT id::text,status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${quote.quote.quoteId}`;expect(task.status).toBe('offen');
 const {completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
 expect(await withSession(operator,()=>completeIntakeTaskAction({taskId:task.id,version:1,note:'TEST allgemeine Aufgabe nicht freigegeben'}))).toMatchObject({code:'FORBIDDEN'});
 const operation=await withSession(operator,()=>readQuoteAction({quoteId:quote.quote.quoteId,purpose:'operations'}));
 expect(operation).toMatchObject({code:'OK',quote:{quoteId:quote.quote.quoteId,version:2,totalNetCents:null,lifecycle:{edition:1,acceptedEdition:null}}});
 if(operation.code!=='OK')throw Error('TEST U249 operational read');
 expect(operation.quote.positions.every(row=>row.unitPriceCents===null&&row.lineTotalCents===null)).toBe(true);expect(operation.quote.lifecycle?.calculation).toBeNull();
 const input={action:'extend' as const,quoteId:quote.quote.quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,validUntil:dates.later,evidence:'TEST Kunde moechte eine laengere Entscheidungsfrist'};
  const extended=await withSession(operator,()=>changeQuoteLifecycleAction(input));
 expect(extended).toMatchObject({code:'OK',quote:{quoteId:input.quoteId,version:3,validUntil:dates.later,totalNetCents:null,lifecycle:{edition:1,acceptedEdition:null}}});
 if(extended.code!=='OK')throw Error('TEST U249 extend');
 expect(extended.quote.positions.every(row=>row.unitPriceCents===null&&row.lineTotalCents===null)).toBe(true);expect(extended.quote.lifecycle?.calculation).toBeNull();
 const accept={action:'accept' as const,quoteId:input.quoteId,expectedVersion:3,edition:1,clientEventId:randomUUID(),evidence:'TEST Kunde sagt diese unveraenderte Fassung telefonisch zu'};
 expect(await withSession(operator,()=>changeQuoteLifecycleAction({...accept,source:{itemId:randomUUID(),version:1,message:true}}))).toMatchObject({code:'NOT_FOUND'});
 expect(await withSession(operator,()=>changeQuoteLifecycleAction(accept))).toMatchObject({code:'OK',quote:{version:4,totalNetCents:null,lifecycle:{acceptedEdition:1}}});
 expect(await withSession(operator,()=>changeQuoteLifecycleAction(accept))).toMatchObject({code:'OK',replayed:true,quote:{version:4,totalNetCents:null}});
 expect(await withSession(operator,()=>changeQuoteLifecycleAction({...accept,evidence:'TEST anderer Wortlaut'}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(operator,()=>changeQuoteLifecycleAction({action:'sent',quoteId:input.quoteId,expectedVersion:4,edition:1,clientEventId:randomUUID(),channel:'druck',evidence:'TEST nicht erlaubt'}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(operator,()=>readQuoteAction({quoteId:input.quoteId}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(operator,()=>readQuoteAction({quoteId:input.quoteId,purpose:'operations'}))).toMatchObject({code:'OK',quote:{totalNetCents:null,actorTrace:{createdBy:{userId:owner.actorId},lastActor:{userId:operator.actorId,action:'QUOTE_LIFECYCLE_V04:accept'}}}});
 expect((await sql`SELECT status,erledigt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${task.id}::uuid`)[0]).toMatchObject({status:'erledigt',erledigt_von:operator.actorId});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${operator.actorId}::uuid AND event_type='QUOTE_FOLLOWUP_COMPLETED_V1' AND payload->>'taskId'=${task.id}`).toHaveLength(1);
 expect(await sql`SELECT bereich FROM public.app_user_rights WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${operator.actorId}::uuid`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${operator.actorId}::uuid AND event_type='QUOTE_LIFECYCLE_V04' AND payload->>'quoteId'=${input.quoteId}`).toHaveLength(2);
 expect(await withSession(operator,()=>readQuoteAction({quoteId:input.quoteId,purpose:'operations'}))).toMatchObject({code:'OK',quote:{version:4,totalNetCents:null,lifecycle:{acceptedEdition:1}}});
 expect(await withSession(owner,()=>readQuoteAction({quoteId:input.quoteId}))).toMatchObject({code:'OK',quote:{version:4,totalNetCents:1234,lifecycle:{edition:1,acceptedEdition:1,acceptanceEvidence:accept.evidence}}});
});


it.each([false,true,'operational'] as const)('AF-8/17 telephone acceptance and goods conversion commit once atomically, existing receipt: %s',async(existingReceipt)=>{
 const fixture=await createFixture();
 if(existingReceipt==='operational'){
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,updated_at) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST U249 Nachfassen',statement_timestamp() WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
  const {readQuoteDefaultsAction}=await import('@/app/actions/quotes.actions');const {saveQuoteSettingsAction}=await import('@/app/actions/settings.actions');
  const defaults=await withSession(fixture,()=>readQuoteDefaultsAction());if(defaults.code!=='OK')throw Error('TEST_DEFAULTS:'+defaults.code);
  expect(await withSession(fixture,()=>saveQuoteSettingsAction({clientEventId:randomUUID(),expectedUpdatedAt:defaults.settings.updatedAt,setupCents:null,materialCents:null,followupDays:3,validityDays:null}))).toMatchObject({code:'OK'});
 }
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST Ware vor Zusage',calculation:{hours:'4',hourlyRateCents:1000,setupCents:0,materialCents:0},specialRequests:'TEST alte Halter erhalten',positions:[{name:'TEST Weber-Trompeten',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
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
 const input={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId,quoteId,expectedQuoteVersion:2,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos,quantities:created.quote.positions.map(position=>({itemId:position.id,expected:4,received:null,confirmed:true,note:null})),location:'TEST Regal E1'};


 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST aktuelle Fassung wirklich gedruckt'}))).toMatchObject({code:'OK'});
 const sent=await withSession(fixture,()=>readQuoteAction({quoteId}));if(sent.code!=='OK')throw Error('TEST_ATOMIC_SENT_READ');
 input.quantities=sent.quote.positions.map(position=>({itemId:position.id,expected:position.quantity,received:null,confirmed:true,note:null}));
 if(existingReceipt)expect(await withSession(fixture,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'OK',receipt:{gesperrt:true,auftrag_id:null}});
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:2,confirmedAward:true as const,confirmedOrderDueDate:'2027-04-20',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:input.id};
 const operator=existingReceipt==='operational'?await createFixture(false,['auftraege'],'werkstatt'):fixture;
 const telephone={clientEventId:randomUUID(),edition:1,evidence:'TEST Kunde sagt am Telefon die aktuelle Fassung zu'};
 if(!existingReceipt){
  // Real late business failure: binding rejects a damaged receipt after acceptance and order planning.
  expect(await withSession(operator,()=>convertQuoteToOrderAction(award,{...input,condition:'abweichung'},telephone))).toMatchObject({code:'VALIDATION_ERROR'});
  expect((await sql`SELECT version,zugesagt_fassung,linked_order_id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0]).toMatchObject({version:2,zugesagt_fassung:null,linked_order_id:null});
  expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${telephone.clientEventId}::uuid`)[0].n).toBe(0);
  expect((await sql`SELECT count(*)::int n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`)[0].n).toBe(0);
  expect((await sql`SELECT count(*)::int n FROM private.quote_conversion_requests WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid`)[0].n).toBe(0);
  expect((await sql`SELECT count(*)::int n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(0);
 }
 const result=await withSession(operator,()=>convertQuoteToOrderAction(award,existingReceipt?undefined:input,telephone));
 expect(result).toMatchObject({code:'OK',quote:{status:'converted',lifecycle:{acceptedEdition:1}}});
 if(result.code!=='OK')throw Error('TEST_ATOMIC_CONVERSION:'+result.code+':'+result.message);
 expect((await sql`SELECT q.zugesagt_fassung,q.linked_order_id,r.auftrag_id,o.ware,o.geprueft FROM private.quotes q JOIN public.goods_receipt r ON r.tenant_id=q.tenant_id AND r.kv_id=q.id JOIN public.orders o ON o.tenant_id=q.tenant_id AND o.id=q.linked_order_id WHERE q.tenant_id=${KREILE_TENANT_SLUG} AND q.id=${quoteId}::uuid`)[0]).toMatchObject({zugesagt_fassung:1,linked_order_id:result.orderReceipt.orderId,auftrag_id:result.orderReceipt.orderId,ware:'da',geprueft:true});
 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${telephone.clientEventId}::uuid AND event_type='QUOTE_LIFECYCLE_V04' AND user_id=${operator.actorId}::uuid`)[0].n).toBe(1);
 expect(await withSession(operator,()=>readQuoteAction({quoteId,purpose:'operations'}))).toMatchObject({code:'OK',quote:{linkedOrderId:result.orderReceipt.orderId,lifecycle:{goods:[{id:input.id,orderId:result.orderReceipt.orderId,blocked:false}]}}});
 expect(await withSession(operator,()=>convertQuoteToOrderAction(award,existingReceipt?undefined:input,telephone))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId:result.orderReceipt.orderId}});
 expect(await withSession(operator,()=>convertQuoteToOrderAction(award,existingReceipt?undefined:input,{...telephone,evidence:'TEST anderer Wortlaut'}))).toMatchObject({code:'CONFLICT'});
 expect((await sql`SELECT count(*)::int n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`)[0].n).toBe(1);
 if(existingReceipt==='operational'){
  expect((await sql`SELECT status,erledigt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${quoteId}`)[0]).toMatchObject({status:'erledigt',erledigt_von:operator.actorId});
  expect(result.orderReceipt.items.every(row=>row.unitPriceCents===null&&row.vatRateBasisPoints===null)).toBe(true);
  expect(result.quote.totalNetCents).toBeNull();expect(result.quote.positions.every(row=>row.unitPriceCents===null&&row.lineTotalCents===null)).toBe(true);
  expect(await withSession(operator,()=>readQuoteAction({quoteId}))).toMatchObject({code:'FORBIDDEN'});
  const {createOrderIntake}=await import('@/lib/server/commands/orderIntakeCommand');
  const {resolveAuthorization}=await import('@/lib/server/authorization');
  const auth=await withSession(operator,()=>resolveAuthorization());expect(auth.ok).toBe(true);if(auth.ok){expect(auth.data.areas).not.toContain('geld');expect(auth.data.areas).not.toContain('eingang');}
  expect(await withSession(operator,()=>createOrderIntake({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId:fixture.customerId},dueDate:'2027-04-20',handoverMode:'pickup',items:[{catalogServiceId:null,name:'TEST Direktversuch',quantity:1,material:null,surfaceRequested:'verchromen',unit:null,unitPriceCents:null,vatRateBasisPoints:null}],note:null}))).toMatchObject({code:'FORBIDDEN'});
  const {undoQuoteConversionAction,readQuoteConversionReceiptAction}=await import('@/app/actions/quotes.actions');
  const beforeUndo=await withSession(operator,()=>readQuoteAction({quoteId,purpose:'operations'}));expect(beforeUndo).toMatchObject({code:'OK',undo:{ready:true,canUndo:true}});
  if(beforeUndo.code!=='OK')throw Error('TEST_UNDO_READ');
  const undo={quoteId,expectedVersion:beforeUndo.quote.version,clientEventId:randomUUID(),reason:'TEST falsche Zuordnung unmittelbar zurückgenommen'};
  const reversed=await withSession(operator,()=>undoQuoteConversionAction(undo));expect(reversed).toMatchObject({code:'OK',replayed:false,orderId:result.orderReceipt.orderId,quote:{status:'draft',linkedOrderId:null,lifecycle:{acceptedEdition:1}}});
  expect((await sql`SELECT status,ware,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${result.orderReceipt.orderId}`)[0]).toMatchObject({status:'storniert',ware:'storniert',version:2});
  expect((await sql`SELECT auftrag_id,kv_id::text FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.id}::uuid`)[0]).toMatchObject({auftrag_id:null,kv_id:quoteId});
  expect((await sql`SELECT vorgang_art,vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0]).toMatchObject({vorgang_art:'kv',vorgang_id:quoteId});
  expect(await withSession(operator,()=>undoQuoteConversionAction(undo))).toMatchObject({code:'OK',replayed:true});
  expect(await withSession(operator,()=>undoQuoteConversionAction({...undo,reason:'TEST anderer Grund'}))).toMatchObject({code:'CONFLICT'});
  expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_CONVERSION_REVERSED_V04' AND client_event_id=${undo.clientEventId}::uuid AND user_id=${operator.actorId}::uuid`)[0].n).toBe(1);
  expect(await withSession(operator,()=>readQuoteConversionReceiptAction({quoteId,clientEventId:award.clientEventId}))).toMatchObject({code:'FORBIDDEN'});
  const restored=await withSession(operator,()=>readQuoteAction({quoteId,purpose:'operations'}));expect(restored).toMatchObject({code:'OK',undo:{ready:true,canUndo:false,automaticSuppressed:true},quote:{linkedOrderId:null,lifecycle:{goods:[{id:input.id,orderId:null}]}}});
  if(restored.code!=='OK')throw Error('TEST_UNDO_RESTORED');
  const again=await withSession(operator,()=>convertQuoteToOrderAction({...award,clientEventId:randomUUID(),expectedVersion:restored.quote.version}));expect(again).toMatchObject({code:'OK',replayed:false});
  if(again.code!=='OK')throw Error('TEST_RECONVERT');expect(again.orderReceipt.orderId).not.toBe(result.orderReceipt.orderId);
  expect(await sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;return (await tx`SELECT count(*)::int n FROM private.v_quote_conversion_receipts_v1 WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid AND integrity_ok`)[0].n;})).toBe(2);
  const {getLiveOrderCardAction,transitionWareneingangToGalvanikAction}=await import('@/app/actions/orders.actions');
  const cancelledCard=await withSession(fixture,()=>getLiveOrderCardAction({orderId:result.orderReceipt.orderId}));expect(cancelledCard).toMatchObject({code:'OK',data:{card:{status:'storniert',cancellation:{reason:undo.reason,quoteId}}}});
  if(cancelledCard.code==='OK')expect(cancelledCard.data.card.commercialQuote).toBeUndefined();
  expect(await withSession(operator,()=>transitionWareneingangToGalvanikAction({orderId:again.orderReceipt.orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  const afterStation=await withSession(operator,()=>readQuoteAction({quoteId,purpose:'operations'}));expect(afterStation).toMatchObject({code:'OK',undo:{ready:true,canUndo:false}});
  if(afterStation.code!=='OK')throw Error('TEST_UNDO_STATION_READ');
  expect(await withSession(operator,()=>undoQuoteConversionAction({quoteId,expectedVersion:afterStation.quote.version,clientEventId:randomUUID(),reason:'TEST nach Folgehandlung gesperrt'}))).toMatchObject({code:'CONFLICT'});
  expect((await sql`SELECT linked_order_id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`)[0].linked_order_id).toBe(again.orderReceipt.orderId);

 }

});

it('workshop quote reader returns real warehouse candidates without financial fields for a non-money login',async()=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readWorkshopQuoteGoodsAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST operational projection',positions:[{name:'TEST Werkstattteil',quantity:2,material:null,surfaceRequested:'verchromen',unitPriceCents:1000,lineTotalCents:2000}]}));
 if(created.code!=='OK')throw Error('TEST_QUOTE_CREATE:'+created.code);const quoteId=created.quote.quoteId;
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST tatsaechlich ausgegeben'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,action:'accept',evidence:'TEST telefonisch zugesagt'}))).toMatchObject({code:'OK'});
 const reader=await createFixture(false,['auftraege']);
 expect(await withSession(reader,()=>readQuoteAction({quoteId}))).toMatchObject({code:'FORBIDDEN'});
 const result=await withSession(reader,()=>readWorkshopQuoteGoodsAction());expect(result.code).toBe('OK');if(result.code!=='OK')throw Error(result.message);
 const row=result.quotes.find(item=>item.id===quoteId);expect(row).toMatchObject({id:quoteId,kind:'expected',parts:'2 × TEST Werkstattteil'});
 expect(row).not.toHaveProperty('totalNetCents');expect(row).not.toHaveProperty('calculation');expect(row).not.toHaveProperty('unitPriceCents');
 const [stored]=await sql`SELECT version,zugesagt_fassung,linked_order_id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`;
 expect(stored).toMatchObject({version:3,zugesagt_fassung:1,linked_order_id:null});
 expect((await withSession(reader,()=>readWorkshopQuoteGoodsAction()))).toMatchObject({code:'OK',quotes:expect.arrayContaining([expect.objectContaining({id:quoteId})])});
});

it('U249 a logged-in workshop actor can record a phone decision without quote creation or money access',async()=>{
 const owner=await createFixture(),actor=await createFixture(false,[],'werkstatt');
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(owner,()=>createQuoteAction({clientEventId:randomUUID(),customerId:owner.customerId,dueDate:'2027-04-20',note:'TEST U249 ohne Fachrechte',calculation:{hours:'2',hourlyRateCents:1000,setupCents:0,materialCents:0},positions:[{name:'TEST Teil Entscheidung',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:2000}]}));
 if(created.code!=='OK')throw Error('TEST_CREATE:'+created.code);const quoteId=created.quote.quoteId;
 expect(await withSession(owner,()=>changeQuoteLifecycleAction({quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST ausgegeben'}))).toMatchObject({code:'OK'});
 const initial=await withSession(actor,()=>readQuoteAction({quoteId,purpose:'operations'}));expect(initial).toMatchObject({code:'OK',canEdit:false,canOperate:true,canReceive:false,quote:{totalNetCents:null,lifecycle:{calculation:null}}});
 const request={quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,action:'accept' as const,evidence:'TEST Telefonzusage durch Werkstatt ohne Geldrecht'};
 const decision=await withSession(actor,()=>changeQuoteLifecycleAction(request));expect(decision).toMatchObject({code:'OK',quote:{totalNetCents:null,lifecycle:{acceptedEdition:1}}});
 expect((await sql`SELECT q.zugesagt_fassung,q.version,e.user_id::text,e.payload->>'proof' AS proof FROM private.quotes q JOIN public.events e ON e.tenant_id=q.tenant_id AND e.client_event_id=${request.clientEventId}::uuid WHERE q.tenant_id=${KREILE_TENANT_SLUG} AND q.id=${quoteId}::uuid`)[0]).toMatchObject({zugesagt_fassung:1,version:3,user_id:actor.actorId,proof:request.evidence});
 expect(await withSession(actor,()=>readQuoteAction({quoteId,purpose:'operations'}))).toMatchObject({code:'OK',quote:{version:3,totalNetCents:null,lifecycle:{acceptedEdition:1}}});
 expect(await withSession(actor,()=>readQuoteAction({quoteId}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(actor,()=>changeQuoteLifecycleAction({quoteId,edition:1,clientEventId:randomUUID(),expectedVersion:3,action:'reject',reason:'TEST keine pauschale Editfreigabe'}))).toMatchObject({code:'FORBIDDEN'});
});


it('reply targets use the real source customer without money rights or financial fields',async()=>{
 const owner=await createFixture(),other=await createFixture(false),actor=await createFixture(false,['mails'],'werkstatt');
 const {createQuoteAction,readQuoteReplyTargetsAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction}=await import('@/app/actions/eingang.actions');
 const input={dueDate:'2027-04-20',note:'TEST reply targets',positions:[{name:'TEST Reply Halter',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]};
 const own=await withSession(owner,()=>createQuoteAction({...input,clientEventId:randomUUID(),customerId:owner.customerId}));
 const foreign=await withSession(other,()=>createQuoteAction({...input,clientEventId:randomUUID(),customerId:other.customerId}));
 if(own.code!=='OK'||foreign.code!=='OK')throw Error('TEST_TARGET_QUOTES');
 const itemId=randomUUID(),source=await withSession(owner,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Bitte diese Antwort zuordnen',context:{customerId:owner.customerId}}));if(source.code!=='OK')throw Error('TEST_TARGET_SOURCE');
 const read=await withSession(actor,()=>readQuoteReplyTargetsAction({sourceItemId:itemId}));
 expect(read).toMatchObject({code:'OK',source:{id:itemId},targets:[{id:own.quote.quoteId,number:own.quote.quoteNumber}],limited:false});
 if(read.code!=='OK')throw Error('TEST_REPLY_TARGETS:'+read.code);expect(read.targets).toHaveLength(1);expect(read.targets.some(row=>row.id===foreign.quote.quoteId)).toBe(false);
 expect(JSON.stringify(read)).not.toMatch(/totalNetCents|unitPriceCents|calculation/);
 expect(await withSession(actor,()=>readQuoteAction({quoteId:own.quote.quoteId}))).toMatchObject({code:'FORBIDDEN'});
 expect((await sql`SELECT version FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${own.quote.quoteId}::uuid`)[0].version).toBe(1);
 expect((await sql`SELECT version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0].version).toBe(source.capture.version);
});

it('AK order: two actual logins retain creator and last actor, take through existing assignment writer and read own statistics',async()=>{
 const first=await createFixture(),second=await createFixture();
 const {createOrderIntake}=await import('@/lib/server/commands/orderIntakeCommand');
 const created=await withSession(first,()=>createOrderIntake({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId:first.customerId},dueDate:'2027-04-20',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',items:[{catalogServiceId:null,name:'TEST AK Halter',quantity:1,material:null,surfaceRequested:'verchromen',executionRequested:'offen',unit:null,unitPriceCents:null,vatRateBasisPoints:null}],note:'TEST AK actor projection'}));
 if(created.code!=='OK')throw Error(created.message);const orderId=created.receipt.orderId;
 const {getLiveOrderCardAction,assignOrderTaskAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(second,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{actors:{createdBy:{userId:first.actorId,action:'ORDER_INTAKE_CREATED_V1'},lastActor:{userId:first.actorId},responsible:{userId:first.actorId,source:'first-event'},currentLoginId:second.actorId}}}});
 const request={orderId,assigneeUserId:second.actorId,expectedVersion:1,clientEventId:randomUUID()};
 const taken=await withSession(second,()=>assignOrderTaskAction(request));expect(taken).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(second,()=>assignOrderTaskAction(request))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND client_event_id=${request.clientEventId}::uuid AND user_id=${second.actorId}::uuid`).toHaveLength(1);
 expect((await sql`SELECT assigned_to::text,active FROM private.order_task_assignment_state WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`)[0]).toMatchObject({assigned_to:second.actorId,active:true});
 const {writeActorAudit}=await import('@/test/fixtures/writeActorAudit');
 const auditEvents=await sql<{user_id:string|null;status:string}[]>`SELECT user_id::text,status FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND client_event_id=${request.clientEventId}::uuid`;
 expect(writeActorAudit({before:{responsible:first.actorId},after:{responsible:second.actorId},actorId:second.actorId,events:auditEvents})).toEqual({code:'OK'});

 expect(await withSession(first,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{actors:{createdBy:{userId:first.actorId},lastActor:{userId:second.actorId,action:'ORDER_TASK_ASSIGNED_V1'},responsible:{userId:second.actorId,source:'assignment'}}}}});
 const {readActorStatistics}=await import('@/lib/server/quoteJournalPort');const {readIntakeActorStatistics}=await import('@/modules/eingang/server-public');const {resolveAuthorization}=await import('@/lib/server/authorization');
 const getActorStatistics=async(input:unknown)=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST AK statistics session');return readActorStatistics(auth.data,input,readIntakeActorStatistics);};
 const {readOrderResponsibilityForToday}=await import('@/lib/server/orderTaskAssignmentRead');
 const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');
 const responsibility=await withSession(second,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST AK responsibility auth');return withPrivilegedTenantTransaction(auth.data,tx=>readOrderResponsibilityForToday(tx,auth.data,[orderId]));});
 expect(responsibility.get(orderId)).toBe(second.actorId);
 const stats=await withSession(second,async()=>{const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());return getActorStatistics({from:today,through:today});});
 expect(stats).toMatchObject({code:'OK',userId:second.actorId,rows:expect.arrayContaining([expect.objectContaining({kind:'order',action:'ORDER_TASK_ASSIGNED_V1',events:1,cases:1})])});
 const all=async(actor:Fixture)=>withSession(actor,async()=>{const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());return getActorStatistics({from:today,through:today,all:true});});
 expect(await all(second)).toMatchObject({code:'FORBIDDEN'});
 const adminDenied=await createFixture(true,['auftraege'],'admin');
 expect(await all(adminDenied)).toMatchObject({code:'FORBIDDEN'});
 const admin=await createFixture(true,['auftraege','statistik_alle'],'admin');
 expect(await all(admin)).toMatchObject({code:'OK',userId:null,rows:expect.arrayContaining([expect.objectContaining({userId:first.actorId,action:'ORDER_INTAKE_CREATED_V1'}),expect.objectContaining({userId:second.actorId,action:'ORDER_TASK_ASSIGNED_V1'})])});

});

it('AK intake: save and change through real note Actions retain both logged-in actors and read them in capture and mail view',async()=>{
 const first=await createFixture(true,['eingang','kunden','mails']),second=await createFixture(true,['eingang','kunden','mails']);
 const {saveIntakeNoteAction,getIntakeCaptureAction,getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
 const itemId=randomUUID();
 expect(await withSession(first,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST AK Originalnotiz',context:{customerId:first.customerId}}))).toMatchObject({code:'OK'});
 expect(await withSession(second,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST AK Notiz nach Gespraech geaendert',context:{customerId:first.customerId}}))).toMatchObject({code:'OK'});
 const trace={createdBy:{userId:first.actorId},lastActor:{userId:second.actorId,action:'INTAKE:original_gespeichert'}};
 expect(await withSession(first,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{id:itemId,actorTrace:trace}});
 expect(await withSession(second,()=>getIntakeMessagesAction('alle'))).toMatchObject({code:'OK',messages:expect.arrayContaining([expect.objectContaining({id:itemId,actorTrace:expect.objectContaining({createdBy:expect.objectContaining(trace.createdBy),lastActor:expect.objectContaining(trace.lastActor)})})])});
});

it('AK invoice: the real invoice creator is distinct from the original importer and the actual card rereads the recorded actor',async()=>{
 const importer=await createFixture(),creator=await createFixture(),itemId=randomUUID(),fileId=randomUUID();
 await sql`UPDATE public.customers SET type='lieferant',name='TEST AK Lieferant',iban=NULL,zahlungsziel_tage=14,payment_preference=NULL,vat_id=NULL,billing_email=NULL,handover_preference=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${importer.customerId}`;
 // Explicit isolated secured-original metadata fixture; no Storage/upload proof is claimed.
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,anliegen,anliegen_offen) VALUES(${itemId}::uuid,${KREILE_TENANT_SLUG},${itemId},'notiz','rein','app',${importer.actorId}::uuid,${importer.customerId},'hand',ARRAY['rechnung'],ARRAY['rechnung'])`;
 await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'anhang','TEST AK Rechnung.jpg','image/jpeg',32,${'f'.repeat(64)},${KREILE_TENANT_SLUG+'/'+'f'.repeat(64)},now(),${importer.actorId}::uuid,1,true,false,'fertig')`;
 await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${randomUUID()}::uuid,${importer.actorId},${sql.json({fileId,sha256:'f'.repeat(64)})})`;
 const {saveIncomingInvoiceAction,getIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
 const saved=await withSession(creator,()=>saveIncomingInvoiceAction({itemId,fileId,version:1,clientKey:randomUUID(),fields:{lieferantId:importer.customerId,nummer:'TEST AK '+itemId,datum:'2026-11-01',netto:'10,00',ust:'1,90',brutto:'11,90',faelligAm:'2026-11-15',iban:'DE02120300000000202051',ibanGeprueft:true},status:'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null}));
 if(saved.code!=='OK')throw Error('TEST AK invoice '+JSON.stringify(saved));
 expect((await sql`SELECT erfasst_von::text FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.invoice.id}::uuid`)[0]).toMatchObject({erfasst_von:creator.actorId});
 expect(await withSession(importer,()=>getIncomingInvoiceAction({id:saved.invoice.id}))).toMatchObject({code:'OK',view:{invoice:{id:saved.invoice.id},actorTrace:{createdBy:{userId:creator.actorId,action:'rechnung.erfassen'},lastActor:{userId:creator.actorId}}}});
});

it('AK-02: quote followups sort the creator first for each login and retain every other persons task',async()=>{
 const a=await createFixture(),b=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteDefaultsAction}=await import('@/app/actions/quotes.actions');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,updated_at) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST AK settings',statement_timestamp() WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 const defaults=await withSession(a,()=>readQuoteDefaultsAction());if(defaults.code!=='OK')throw Error('TEST AK quote defaults');const {saveQuoteSettingsAction}=await import('@/app/actions/settings.actions');
 expect(await withSession(a,()=>saveQuoteSettingsAction({clientEventId:randomUUID(),expectedUpdatedAt:defaults.settings.updatedAt,setupCents:defaults.settings.setupCents,materialCents:defaults.settings.materialCents,followupDays:5,validityDays:defaults.settings.validityDays}))).toMatchObject({code:'OK'});
 const ids:string[]=[];
 for(const actor of [a,b]){
  const result=await withSession(actor,()=>createQuoteAction({clientEventId:randomUUID(),customerId:actor.customerId,dueDate:'2027-04-20',note:'TEST AK followup',positions:[{name:'TEST AK Halter',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
  if(result.code!=='OK')throw Error('TEST AK followup '+result.message);ids.push(result.quote.quoteId);
  expect(await withSession(actor,()=>changeQuoteLifecycleAction({action:'sent',quoteId:result.quote.quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST AK tatsaechlich persoenlich ausgehaendigt'}))).toMatchObject({code:'OK'});
 }
 const {readQuoteFollowupTasksForToday}=await import('@/modules/tasks/server-public');const {resolveAuthorization}=await import('@/lib/server/authorization');const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');
 const read=async(actor:Fixture)=>withSession(actor,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST AK task auth');return withPrivilegedTenantTransaction(auth.data,tx=>readQuoteFollowupTasksForToday(tx,auth.data,'2030-12-31'));});
 const mineA=await read(a),mineB=await read(b);expect(mineA).toHaveLength(2);expect(mineB).toHaveLength(2);
 expect(mineA[0]).toMatchObject({quoteId:ids[0],isMine:true});expect(mineB[0]).toMatchObject({quoteId:ids[1],isMine:true});expect(new Set(mineA.map(row=>row.id))).toEqual(new Set(mineB.map(row=>row.id)));
});

it.each([false,true,'partial','operational'] as const)('AF-6: two package receipts preserve every source; damaged secondary blocks the whole conversion: %s',async(damaged)=>{
 const fixture=await createFixture();
 const {createQuoteAction,changeQuoteLifecycleAction,convertQuoteToOrderAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const {saveIntakeNoteAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST AF6 zwei reale Pakete',positions:[{name:'TEST Halter',quantity:4,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
 if(created.code!=='OK')throw Error('TEST AF6 quote');
 const quoteId=created.quote.quoteId,receipts:string[]=[],sources:string[]=[],inspections:Array<NonNullable<ReturnType<typeof import('@/modules/eingang/public').parseQuoteGoodsReceiptInput>>>=[];
 for(const [index,amount] of [2,3].entries()){
  const itemId=randomUUID();sources.push(itemId);
  const capture=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST AF6 Paket '+index,context:{customerId:fixture.customerId}}));
  if(capture.code!=='OK')throw Error('TEST AF6 capture');
  const photos=[{fileId:randomUUID(),kind:'uebersicht' as const},{fileId:randomUUID(),kind:'teile' as const},...(damaged&&damaged!=='operational'&&index===1?[{fileId:randomUUID(),kind:'abweichung' as const}]:[])];
  for(const [photoIndex,photo] of photos.entries()){
   const hash=(photoIndex?'d':'c').repeat(64);
   await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${photo.fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${photo.fileId},'foto','TEST-AF6.jpg','image/jpeg',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},now(),${fixture.actorId}::uuid,${photoIndex+1},true,false,'fertig')`;
   await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${photo.fileId}::uuid,${fixture.actorId},${sql.json({fileId:photo.fileId,sha256:hash,bytes:32})})`;
  }
  const id=randomUUID();receipts.push(id);
  const inspection:NonNullable<ReturnType<typeof import('@/modules/eingang/public').parseQuoteGoodsReceiptInput>>={id,clientKey:randomUUID(),clientEventId:randomUUID(),itemId,quoteId,expectedQuoteVersion:1,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung',command:'accept',card:1,packagesReceived:damaged==='partial'&&index===1?2:1,packagesTotal:damaged==='partial'&&index===1?3:1,condition:damaged&&damaged!=='operational'&&index===1?(damaged==='partial'?'teillieferung':'abweichung'):'unauffaellig',deviations:damaged===true&&index===1?['beschädigt']:[],foundUnattended:false,foundAt:null,procedure:'stimmt',procedureNote:null,photos,quantities:created.quote.positions.map(position=>({itemId:position.id,expected:position.quantity,received:amount,confirmed:false,note:'TEST tatsaechlich angenommene Teilmenge'})),location:'TEST AF6 Regal '+index};inspections.push(inspection);
  expect(await withSession(fixture,()=>saveGoodsReceiptAction(inspection))).toMatchObject({code:'OK'});
 }
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,channel:'druck',evidence:'TEST AF6 aktuelle Fassung gedruckt'}))).toMatchObject({code:'OK'});
 expect(await withSession(fixture,()=>changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:randomUUID(),expectedVersion:2,edition:1,evidence:'TEST AF6 aktuelle Fassung zugesagt'}))).toMatchObject({code:'OK'});
 const input={quoteId,clientEventId:randomUUID(),expectedVersion:3,confirmedAward:true as const,confirmedOrderDueDate:'2027-04-20',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:receipts[0]};
 if(damaged==='operational'){
  const operator=await createFixture(false,[]);
  const {createOrderIntake}=await import('@/lib/server/commands/orderIntakeCommand');
  const direct={geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING' as const,customerId:fixture.customerId},dueDate:'2027-04-20',termStatus:'bestaetigt' as const,intakeSource:null,handoverMode:'pickup' as const,items:[{catalogServiceId:null,name:'TEST unauthorized',quantity:1,material:null,surfaceRequested:'verchromen',executionRequested:'offen',unit:null,unitPriceCents:null,vatRateBasisPoints:null}],note:null};
  expect(await withSession(operator,()=>createOrderIntake(direct))).toMatchObject({code:'FORBIDDEN'});
  const {prepareQuoteConversionCommand}=await import('@/modules/quotes/server-public');
  const {resolveAuthorization}=await import('@/lib/server/authorization');
  const deniedKey=randomUUID(),deniedInput={...direct,clientEventId:deniedKey,paymentMode:'rechnung' as const};
  expect(await withSession(operator,()=>createOrderIntake(deniedInput,undefined,{quoteAuthorization:{quoteId},before:async tx=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST canonical quote authorization');const prepared=await prepareQuoteConversionCommand({tenantId:auth.data.tenantId,userId:auth.data.userId,capabilities:{canCreateQuote:false,canReadQuote:true,canUpdateQuote:false,canConvertQuote:true}},{...input,clientEventId:deniedKey},{transaction:tx});if(prepared.code!=='OK')throw Error('TEST canonical reservation');},after:async()=>undefined}))).toMatchObject({code:'FORBIDDEN'});
  expect(await sql`SELECT quote_id FROM private.quote_conversion_requests WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${deniedKey}::uuid`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(0);
  const converted=await withSession(operator,()=>convertQuoteToOrderAction(input));
  expect(converted).toMatchObject({code:'OK'});if(converted.code!=='OK')throw Error('TEST U249 conversion:'+converted.message);
  expect(converted.quote.totalNetCents).toBeNull();
  expect(converted.orderReceipt.items.every(row=>row.unitPriceCents===null&&row.vatRateBasisPoints===null)).toBe(true);
  expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(1);
  expect((await sql`SELECT quantity::int FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${converted.orderReceipt.orderId}`)[0]).toMatchObject({quantity:5});
  expect(await sql`SELECT id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid AND auftrag_id=${converted.orderReceipt.orderId}`).toHaveLength(2);
  expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${sql.array(sources)}::uuid[]) AND vorgang_art='auftrag' AND vorgang_id=${converted.orderReceipt.orderId}`).toHaveLength(2);
  expect(await withSession(operator,()=>convertQuoteToOrderAction(input))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId:converted.orderReceipt.orderId}});
  expect(await withSession(operator,()=>readQuoteAction({quoteId}))).toMatchObject({code:'FORBIDDEN'});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${converted.orderReceipt.orderId} AND user_id=${operator.actorId}::uuid AND event_type='ORDER_INTAKE_CREATED_V1'`).toHaveLength(1);
  expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:converted.orderReceipt.orderId}});
  return;
 }
 let converted=await withSession(fixture,()=>convertQuoteToOrderAction(input));
 if(damaged){
  expect(converted).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Warenabweichung')});
  expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(0);
  expect(await sql`SELECT quote_id FROM private.quote_conversion_requests WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid AND auftrag_id IS NULL`).toHaveLength(2);
  expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${sql.array(sources)}::uuid[]) AND vorgang_art='kv' AND vorgang_id=${quoteId}`).toHaveLength(2);
  expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{goods:expect.arrayContaining([expect.objectContaining({id:receipts[1],blocked:true})])}}});
  const operator=await createFixture(false,[]);
  expect(await sql`SELECT bereich FROM public.app_user_rights WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${operator.actorId}::uuid`).toHaveLength(0);
  const clarification={...inspections[1],command:'clarify' as const,expectedVersion:1,expectedQuoteVersion:3,clientEventId:randomUUID(),clarificationReason:'TEST Kunde hat die Abweichung besprochen und die Bearbeitung dieser Ware bestaetigt'};
  expect(await withSession(operator,()=>saveGoodsReceiptAction({...clarification,clientEventId:randomUUID(),condition:'unauffaellig',deviations:[]}))).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Prüfdaten unverändert')});
  const uiClarification={command:'clarify' as const,quoteId,receiptId:receipts[1],expectedVersion:1,expectedQuoteVersion:3,clientEventId:clarification.clientEventId,reason:clarification.clarificationReason};
   expect(await withSession(operator,()=>saveGoodsReceiptAction(uiClarification))).toMatchObject({code:'OK',receipt:{id:receipts[1],version:2,gesperrt:false,zustand:inspections[1].condition,packstuecke_da:inspections[1].packagesReceived,packstuecke_gesamt:inspections[1].packagesTotal,abweichung_geklaert:{reason:clarification.clarificationReason,actorId:operator.actorId}}});
  expect(await withSession(operator,()=>saveGoodsReceiptAction(uiClarification))).toMatchObject({code:'OK',replayed:true});
  expect(await withSession(operator,()=>saveGoodsReceiptAction({...uiClarification,reason:'TEST anderer Grund'}))).toMatchObject({code:'CONFLICT'});
  expect(await withSession(operator,()=>readQuoteAction({quoteId}))).toMatchObject({code:'FORBIDDEN'});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${sources[1]}::uuid AND befehl_id=${clarification.clientEventId}::uuid AND von=${operator.actorId} AND nachher->>'action'='kv.abweichung_geklaert'`).toHaveLength(1);
  const [facts]=await sql`SELECT zustand,abweichung,packstuecke_da,packstuecke_gesamt,fotos,mengen FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${receipts[1]}::uuid`;
  expect(facts).toMatchObject({zustand:inspections[1].condition,abweichung:inspections[1].deviations,packstuecke_da:inspections[1].packagesReceived,packstuecke_gesamt:inspections[1].packagesTotal,fotos:inspections[1].photos});
  expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{goods:expect.arrayContaining([expect.objectContaining({id:receipts[1],blocked:false,clearance:{reason:clarification.clarificationReason,actorId:operator.actorId,at:expect.any(String)}})])}}});
  converted=await withSession(fixture,()=>convertQuoteToOrderAction(input));

 }
 expect(converted).toMatchObject({code:'OK'});if(converted.code!=='OK')throw Error('TEST AF6 convert:'+converted.message);
 expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(1);
 expect((await sql`SELECT quantity::int FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${converted.orderReceipt.orderId}`)[0]).toMatchObject({quantity:5});
 const bound=await sql`SELECT id::text,auftrag_id,mengen FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid ORDER BY id`;
 expect(bound).toHaveLength(2);expect(bound.every(row=>row.auftrag_id===converted.orderReceipt.orderId)).toBe(true);
 expect(bound.map(row=>Number(row.mengen[0].bestaetigt)).sort()).toEqual([2,3]);
 expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${sql.array(sources)}::uuid[]) AND vorgang_art='auftrag' AND vorgang_id=${converted.orderReceipt.orderId}`).toHaveLength(2);
 const [event]=await sql`SELECT user_id::text,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${converted.orderReceipt.orderId} AND event_type='GOODS_RECEIPT_SAVED_V1'`;
 expect(event.user_id).toBe(fixture.actorId);expect(event.payload.after.boundReceipts).toHaveLength(2);
 expect(await withSession(fixture,()=>convertQuoteToOrderAction(input))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId:converted.orderReceipt.orderId}});
 expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:converted.orderReceipt.orderId,lifecycle:{goods:expect.arrayContaining(receipts.map(id=>expect.objectContaining({id,orderId:converted.orderReceipt.orderId})))}}});
 if(damaged)expect(await withSession(fixture,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{lifecycle:{goods:expect.arrayContaining([expect.objectContaining({id:receipts[1],clearance:expect.objectContaining({reason:expect.stringContaining('TEST Kunde')})})])}}});
 console.info('TEST_AF6_DB_PROOF',JSON.stringify({orderId:converted.orderReceipt.orderId,receipts,quantity:5,actor:fixture.actorId}));
});

it.each(['early','label','two','future','delivered'] as const)('AF19 real mail handover writer preserves order/customer truths and callback receipts: %s',async(kind)=>{
 const fixture=await createFixture();await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${fixture.actorId}::uuid,'mails',${fixture.actorId}::uuid)`;
 await sql`UPDATE public.customers SET handover_preference='shipping' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
 const {createOrderIntake}=await import('@/lib/server/commands/orderIntakeCommand');
 const input={geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING' as const,customerId:fixture.customerId},dueDate:'2027-04-20',termStatus:'bestaetigt' as const,intakeSource:'anfrage_mail' as const,handoverMode:'shipping' as const,paymentMode:'rechnung' as const,items:[{catalogServiceId:null,name:'TEST AF19 Halter',quantity:1,material:null,surfaceRequested:'verchromen',executionRequested:'offen',unit:null,unitPriceCents:null,vatRateBasisPoints:null}],note:'TEST AF19 Auftrag'};
 const created=await withSession(fixture,()=>createOrderIntake(input));if(created.code!=='OK')throw Error('TEST AF19 order:'+created.message);const orderId=created.receipt.orderId;
 if(kind==='two')expect(await withSession(fixture,()=>createOrderIntake({...input,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 if(kind==='label')await sql`INSERT INTO public.shipments(tenant_id,order_id,carrier,label_url,status) VALUES(${KREILE_TENANT_SLUG},${orderId},'TEST eingestellter Versanddienst','https://fixture.invalid/TEST-label','pending')`;
 if(kind==='delivered'){
  const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
  const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
  const {saveCustomerAgreementAction}=await import('@/app/actions/customers.actions');
  const agreement=await withSession(fixture,()=>saveCustomerAgreementAction({clientKey:randomUUID(),customerId:fixture.customerId,orderId:null,type:'sammelrechnung',targetDays:30,validUntil:null,reason:'TEST AF19 real delivered prerequisite',version:null}));
  if(agreement.code!=='OK')throw Error('TEST AF19 agreement:'+agreement.message);
  await sql`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by,effective_at) SELECT ${randomUUID()}::uuid,${KREILE_TENANT_SLUG},12000,coalesce(max(version),0)+1,${fixture.actorId}::uuid,now() FROM private.extra_work_hourly_rates WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  expect(await withSession(fixture,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>setOrderItemFinishedAction({orderId,itemId:created.receipt.items[0].id,expectedVersion:2,clientEventId:randomUUID(),finished:true}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:3,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>recordGoodsOutAction({orderId,mode:'versand',expectedVersion:4,clientEventId:randomUUID(),agreement:{id:agreement.agreement.id,type:'sammelrechnung',version:agreement.agreement.version}}))).toMatchObject({code:'OK'});
 }
 const itemId=randomUUID(),fileId=randomUUID(),originalHash='e'.repeat(64),sender='kv-'+fixture.customerId+'@local.invalid',text=kind==='future'?'Ab jetzt immer abholen.':'Hole ich ab.';
 // Explicit isolated imported-mail/provider-edge fixture; the Action, writers, authorization and readback stay real.
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,vorgang_art,vorgang_id,zuordnung,einsatz,text,anliegen,anliegen_offen,absender_adresse,graph_message_id,empfangen_am) VALUES(${itemId}::uuid,${KREILE_TENANT_SLUG},${itemId},'mail','rein','mailabruf',${fixture.actorId}::uuid,${fixture.customerId},${kind==='delivered'?'auftrag':null},${kind==='delivered'?orderId:null},'hand','offen',${text},ARRAY['abholung'],ARRAY['abholung'],${sender},${'TEST-AF19-'+itemId},statement_timestamp())`;
 await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'mime','TEST AF19.eml','message/rfc822',32,${originalHash},${KREILE_TENANT_SLUG+'/'+originalHash},now(),${fixture.actorId}::uuid,1,true,false,'fertig')`;
 for(const [art,payload] of [['original_gespeichert',{fileId,sha256:originalHash,bytes:32}],['einsatz',{action:'mail_import_complete',fileIds:[fileId]}]] as const)await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,${art},${randomUUID()}::uuid,${fixture.actorId},${sql.json(payload)})`;
 const {changeOrderPickupNoticeAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const request={command:'handover_from_mail',sourceItemId:itemId,sourceVersion:1,clientEventId:randomUUID()};
 if(kind==='two'){
  const choice=await withSession(fixture,()=>changeOrderPickupNoticeAction(request));expect(choice).toMatchObject({code:'VALIDATION_ERROR',choices:expect.arrayContaining([expect.objectContaining({id:orderId})])});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toHaveLength(0);
  expect((await sql`SELECT version,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0]).toMatchObject({version:1,anliegen_offen:['abholung']});
 }
 const selected=kind==='two'?{...request,orderId,expectedVersion:1}:request;
 const result=await withSession(fixture,()=>changeOrderPickupNoticeAction(selected));expect(result).toMatchObject({code:'OK',replayed:false,receipt:{orderId,handoverMode:kind==='label'||kind==='delivered'?'shipping':'pickup',outcome:kind==='label'||kind==='delivered'?'call_customer':'changed',mailActor:{kind:'mail',sender,originalItemId:itemId,originalSha256:originalHash}}});
 expect(await withSession(fixture,()=>changeOrderPickupNoticeAction(selected))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>changeOrderPickupNoticeAction({...selected,sourceVersion:2}))).toMatchObject({code:'CONFLICT'});
 expect((await sql`SELECT handover_mode,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`)[0]).toMatchObject({handover_mode:kind==='label'||kind==='delivered'?'shipping':'pickup',version:kind==='delivered'?6:2});
 expect((await sql`SELECT handover_preference FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`)[0].handover_preference).toBe(kind==='future'?'pickup':'shipping');
 expect((await sql`SELECT vorgang_art,vorgang_id,version,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0]).toMatchObject({vorgang_art:'auftrag',vorgang_id:orderId,version:2,anliegen_offen:[]});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND event_type='ORDER_HANDOVER_MAIL_V1' AND user_id=${fixture.actorId}::uuid AND payload->'receipt'->'mailActor'->>'originalSha256'=${originalHash}`).toHaveLength(1);
 const view=await withSession(fixture,()=>getLiveOrderCardAction({orderId}));expect(view).toMatchObject({code:'OK',data:{card:{handoverMode:kind==='label'||kind==='delivered'?'shipping':'pickup',handoverNotice:{originalItemId:itemId,message:expect.any(String),...(kind==='label'||kind==='delivered'?{taskState:'offen'}:{taskId:null})}}}});
 const tasks=await sql`SELECT id::text,titel,notiz,bezug_id,status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${request.clientEventId}::uuid`;
 if(kind==='label'||kind==='delivered'){expect(tasks).toHaveLength(1);expect(tasks[0]).toMatchObject({bezug_id:orderId,status:'offen',titel:expect.stringContaining('+49 711 5550189'),notiz:expect.stringContaining(kind==='label'?'Versandetikett':'bereits übergeben')});expect(result).toMatchObject({receipt:{taskId:tasks[0].id}});}else expect(tasks).toHaveLength(0);
 if(kind==='future')expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='CUSTOMER_UPDATED_V1' AND payload::text LIKE ${'%'+fixture.customerId+'%'}`).toHaveLength(1);
 if(kind==='early'){
  const {assignIntakeCustomerAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(fixture,()=>assignIntakeCustomerAction({itemId,version:2,clientEventId:randomUUID(),customerId:fixture.customerId,mode:'move'}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId,handoverMode:'pickup',handoverNotice:{originalItemId:itemId}}}});
 }

});

it('AK-04 real replay gate rejects an actual changed row without an event; rollback preserves the fixture',async()=>{
 const fixture=await createFixture();const {writeActorAudit}=await import('@/test/fixtures/writeActorAudit');
 const [before]=await sql`SELECT name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
 const rollback=new Error('TEST AK04 ROLLBACK');
 await expect(sql.begin(async tx=>{
  const [clock]=await tx`SELECT clock_timestamp() AS at`;
  await tx`UPDATE public.customers SET name='TEST AK04 intentionally unaudited' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
  const [after]=await tx`SELECT name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
  const events=await tx<{user_id:string|null;status:string}[]>`SELECT user_id::text,status FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND created_at>=${clock.at}`;
  expect(after.name).toBe('TEST AK04 intentionally unaudited');
  expect(writeActorAudit({before,after,actorId:fixture.actorId,events})).toEqual({code:'WRITE_WITHOUT_LOGIN_EVENT'});
  throw rollback;
 })).rejects.toBe(rollback);
 expect((await sql`SELECT name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`)[0]).toEqual(before);
});

it('PE-04 actual package history offers existing customers without assigning; selected customer writes once and rereads',async()=>{
 const fixture=await createFixture();const {createOrderIntake}=await import('@/lib/server/commands/orderIntakeCommand');
 const created=await withSession(fixture,()=>createOrderIntake({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId:fixture.customerId},dueDate:'2027-04-20',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',items:[{catalogServiceId:null,name:'TEST Tuergriff',quantity:2,material:null,surfaceRequested:'verchromen',executionRequested:'offen',unit:null,unitPriceCents:null,vatRateBasisPoints:null}],note:'TEST PE04 historical source'}));
 expect(created.code).toBe('OK');
 const quoteCustomer=await createFixture();const {createQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
 const priorQuote=await withSession(quoteCustomer,()=>createQuoteAction({clientEventId:randomUUID(),customerId:quoteCustomer.customerId,dueDate:'2027-04-20',note:'TEST closed package history',positions:[{name:'TEST Tuergriff',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
 if(priorQuote.code!=='OK')throw Error(priorQuote.message);
 expect(await withSession(quoteCustomer,()=>changeQuoteLifecycleAction({quoteId:priorQuote.quote.quoteId,expectedVersion:1,edition:1,clientEventId:randomUUID(),action:'reject',reason:'TEST historische nicht erteilte Anfrage'}))).toMatchObject({code:'OK'});
 const {saveIntakeNoteAction,getIntakeCaptureAction,assignIntakeCustomerAction}=await import('@/app/actions/eingang.actions');
 const itemId=randomUUID();const saved=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'DPD Paket mit 2 Tuergriff verchromen'}));
 if(saved.code!=='OK')throw Error(saved.message);
 expect(saved.capture.customerId).toBeNull();
 expect(saved.capture.packageContext).toBeUndefined();
 const expected=await withSession(fixture,()=>getIntakeCaptureAction(itemId,undefined,{packageExpectation:true}));if(expected.code!=='OK')throw Error(expected.message);
 expect(expected.capture.packageContext).toMatchObject({status:'OK',customers:expect.arrayContaining([expect.objectContaining({customerId:fixture.customerId,source:'order'})])});
 expect(expected.capture.packageContext).toMatchObject({status:'OK',customers:expect.arrayContaining([expect.objectContaining({customerId:quoteCustomer.customerId,source:'quote'})])});
 expect(expected.capture.packageContext?.status==='OK'&&expected.capture.packageContext.customers.length).toBeLessThanOrEqual(3);
 expect((await sql`SELECT kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0].kunde_id).toBeNull();
 const request={itemId,version:saved.capture.version,clientEventId:randomUUID(),customerId:fixture.customerId,mode:'manual' as const};
 expect(await withSession(fixture,()=>assignIntakeCustomerAction(request))).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(fixture,()=>assignIntakeCustomerAction(request))).toMatchObject({code:'OK',replayed:true});
 expect((await sql`SELECT kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0].kunde_id).toBe(fixture.customerId);
 expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${request.clientEventId}::uuid AND von=${fixture.actorId}`).toHaveLength(1);
 expect(await withSession(fixture,()=>getIntakeCaptureAction(itemId,undefined,{packageExpectation:true}))).toMatchObject({code:'OK',capture:{customerId:fixture.customerId,packageContext:{status:'OK',customers:[]}}});
});

it('PE-06 two actual accepted quotes remain ambiguous and a restricted capture reader receives no hidden candidates',async()=>{
 const fixture=await createFixture();const {createQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');const quoteIds:string[]=[];
 for(const label of ['TEST Halter links','TEST Halter rechts']){
  const made=await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST PE06 explicit alternatives',positions:[{name:label,quantity:2,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));
  if(made.code!=='OK')throw Error(made.message);quoteIds.push(made.quote.quoteId);
  expect(await withSession(fixture,()=>changeQuoteLifecycleAction({quoteId:made.quote.quoteId,expectedVersion:1,edition:1,clientEventId:randomUUID(),action:'sent',channel:'druck',evidence:'TEST aktuelle Fassung tatsaechlich gedruckt'}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>changeQuoteLifecycleAction({quoteId:made.quote.quoteId,expectedVersion:2,edition:1,clientEventId:randomUUID(),action:'accept',evidence:'TEST ausdrueckliche Zusage'}))).toMatchObject({code:'OK'});
 }
 const {saveIntakeNoteAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');const itemId=randomUUID();
 const saved=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'DPD Paket mit 2 Halter',context:{customerId:fixture.customerId}}));
 if(saved.code!=='OK')throw Error(saved.message);
 expect(saved.capture.packageContext).toBeUndefined();
 const read=await withSession(fixture,()=>getIntakeCaptureAction(itemId,undefined,{packageExpectation:true}));if(read.code!=='OK')throw Error(read.message);
 expect(read.capture.packageContext).toMatchObject({status:'OK',ambiguous:true,candidates:expect.arrayContaining(quoteIds.map(id=>expect.objectContaining({kind:'quote',id,state:'accepted'})))});
 if(read.capture.packageContext?.status==='OK')expect(read.capture.packageContext.candidates.every(candidate=>!Object.hasOwn(candidate,'totalNetCents'))).toBe(true);
 expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${fixture.customerId}`).toHaveLength(0);
 const workshop=await createFixture(false,['eingang','kunden','auftraege'],'werkstatt');
 const workshopRead=await withSession(workshop,()=>getIntakeCaptureAction(itemId,undefined,{packageExpectation:true}));
 expect(workshopRead).toMatchObject({code:'OK',capture:{packageContext:{status:'OK',ambiguous:true,candidates:expect.arrayContaining(quoteIds.map(id=>expect.objectContaining({id,state:'accepted'})))}}});
 if(workshopRead.code==='OK'&&workshopRead.capture.packageContext?.status==='OK')for(const candidate of workshopRead.capture.packageContext.candidates)expect(candidate).not.toHaveProperty('totalNetCents');
 const restricted=await createFixture(false,['eingang']);const otherId=randomUUID();
 const limitedSaved=await withSession(restricted,()=>saveIntakeNoteAction({itemId:otherId,textstand:randomUUID(),text:'DPD Paket mit 2 Halter'}));
 expect(limitedSaved).toMatchObject({code:'OK'});
 const limited=await withSession(restricted,()=>getIntakeCaptureAction(otherId,undefined,{packageExpectation:true}));
 expect(limited).toMatchObject({code:'OK',capture:{packageContext:{status:'OK',customers:[],candidates:[]}}});
 if(limited.code==='OK')expect(limited.capture.expectedOrders).toBeUndefined();
});

it('PE204 customer-filtered existing quote reader excludes other customers before its limit',async()=>{
 const first=await createFixture(),second=await createFixture();
 const {createQuoteAction}=await import('@/app/actions/quotes.actions');
 for(const fixture of [first,second])expect(await withSession(fixture,()=>createQuoteAction({clientEventId:randomUUID(),customerId:fixture.customerId,dueDate:'2027-04-20',note:'TEST PE204 customer scope',positions:[{name:'TEST Paketfilter',quantity:2,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}))).toMatchObject({code:'OK'});
 const {resolveAuthorization}=await import('@/lib/server/authorization');
 const {quoteOperationContext}=await import('@/lib/server/quoteAuthorization');
 const {listOpenQuotesCommand}=await import('@/modules/quotes/server-public');
 const filtered=await withSession(first,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST auth missing');return listOpenQuotesCommand(quoteOperationContext(auth.data),first.customerId);});
 expect(filtered).toMatchObject({code:'OK',quotes:[expect.objectContaining({customerId:first.customerId})]});
 if(filtered.code==='OK')expect(filtered.quotes.every(quote=>quote.customerId===first.customerId)).toBe(true);
});


it.each(['admin','buero','werkstatt','developer'] as const)('PE204 final rights and unassigned candidates: %s matches main plus U-249 without amounts',async role=>{
 const owner=await createFixture();const token='Pruefteil'+randomUUID().replaceAll('-','');
 const {createQuoteAction,changeQuoteLifecycleAction,readWorkshopQuoteGoodsAction}=await import('@/app/actions/quotes.actions');
 const made=await withSession(owner,()=>createQuoteAction({clientEventId:randomUUID(),customerId:owner.customerId,dueDate:'2027-04-20',note:'TEST final rights',positions:[{name:token,quantity:2,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]}));if(made.code!=='OK')throw Error(made.message);
 expect(await withSession(owner,()=>changeQuoteLifecycleAction({quoteId:made.quote.quoteId,expectedVersion:1,edition:1,clientEventId:randomUUID(),action:'sent',channel:'druck',evidence:'TEST tatsächlicher Druck'}))).toMatchObject({code:'OK'});
 expect(await withSession(owner,()=>changeQuoteLifecycleAction({quoteId:made.quote.quoteId,expectedVersion:2,edition:1,clientEventId:randomUUID(),action:'accept',evidence:'TEST tatsächliche Zusage'}))).toMatchObject({code:'OK'});
 const {saveIntakeNoteAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');const itemId=randomUUID();
 expect(await withSession(owner,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'DPD Paket '+token}))).toMatchObject({code:'OK'});
 const reader=await createFixture(false,['eingang','kunden','auftraege'],role);
 const candidate=await withSession(reader,()=>getIntakeCaptureAction(itemId,undefined,{packageExpectation:true}));
 const goods=await withSession(reader,()=>readWorkshopQuoteGoodsAction());
 if(role==='developer'){expect(candidate.code).toBe('FORBIDDEN');expect(goods.code).toBe('FORBIDDEN');return;}
 expect(candidate).toMatchObject({code:'OK',capture:{customerId:null,packageContext:{status:'OK',candidates:[expect.objectContaining({id:made.quote.quoteId,customerId:owner.customerId,state:'accepted'})]}}});
 expect(goods).toMatchObject({code:'OK',quotes:expect.arrayContaining([expect.objectContaining({id:made.quote.quoteId})])});
 if(candidate.code==='OK'&&candidate.capture.packageContext?.status==='OK')for(const row of candidate.capture.packageContext.candidates){expect(row).not.toHaveProperty('totalNetCents');expect(row).not.toHaveProperty('positions');}
 expect(JSON.stringify(goods)).not.toMatch(/unitPriceCents|totalNetCents|lineTotalCents/);
 expect((await sql`SELECT kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`)[0].kunde_id).toBeNull();
});
