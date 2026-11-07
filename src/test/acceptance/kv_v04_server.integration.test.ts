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
