// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

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

async function createFixture(): Promise<Fixture> {
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
      FROM unnest(ARRAY['eingang', 'auftraege', 'kunden', 'geld']::text[]) area
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
