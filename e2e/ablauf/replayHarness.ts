// @vitest-environment node
// TEST provider boundary only. Server action, authorization, Replay DB and Storage are real.
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import postgres from 'postgres';
import {beforeAll,afterAll,afterEach,vi} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import type {AppSession} from '@/lib/server/appSession';
(globalThis as typeof globalThis & {AsyncLocalStorage:typeof AsyncLocalStorage}).AsyncLocalStorage=AsyncLocalStorage;
vi.setConfig({testTimeout:60000,hookTimeout:60000});
const database=process.env.DATABASE_URL;
if(!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('ABL_TEST_TENANT_REQUIRED_BEFORE_ANY_WRITE');
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/postgres')throw Error('EIN34_DEDICATED_LOCAL_REPLAY_REQUIRED');
const sql=postgres(database,{max:2,prepare:false});
const originalEnv={...process.env};
const nativeFetch=globalThis.fetch;
type Fixture={actorId:string;actorIssuedAt:number;role:AppSession['role']};
let full:Fixture;
let storageApi='';
beforeAll(async()=>{
 const raw=execFileSync(process.execPath,[path.resolve('node_modules/supabase/dist/supabase.js'),'status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000});
 const local=JSON.parse(raw) as Record<string,string>;
 storageApi=local.API_URL;
 if(new URL(storageApi).hostname!=='127.0.0.1'||!local.SERVICE_ROLE_KEY)throw Error('EIN34_LOOPBACK_STORAGE_REQUIRED');
 process.env.NEXT_PUBLIC_SUPABASE_URL=storageApi;
 process.env.SUPABASE_SERVICE_ROLE_KEY=local.SERVICE_ROLE_KEY;
 process.env.APP_SESSION_SECRET='TEST-ein34-local-only';
 process.env.MS_GRAPH_TENANT_ID='TEST-tenant';process.env.MS_GRAPH_CLIENT_ID='TEST-client';process.env.MS_GRAPH_CLIENT_SECRET='TEST-provider-fixture';process.env.MS_GRAPH_MAILBOX='TEST-mailbox@example.invalid';
 full=await createFixture(['eingang','mails','kunden','auftraege','geld','einstellungen']);
});
afterAll(async()=>{vi.restoreAllMocks();for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];Object.assign(process.env,originalEnv);await sql.end({timeout:5});});
async function withRequest<T>(cookie: string, work: () => Promise<T>,flushAfter=false): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/TEST-ein34-mail", { headers: { cookie } });
  const afterJobs:Promise<unknown>[]=[],closeCallbacks:Array<()=>void>=[],afterErrors:unknown[]=[];
  const {AfterContext}=await import('next/dist/server/after/after-context');
  const nativeAfter=flushAfter?new AfterContext({waitUntil:promise=>{afterJobs.push(promise);},onClose:callback=>{closeCallbacks.push(callback);},onTaskError:error=>{afterErrors.push(error);}}):{};
  const workStore = {
    isStaticGeneration: false,
    page: "/TEST-ein34-mail",
    route: "/TEST-ein34-mail",
    afterContext: nativeAfter,
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
    { pathname: "/TEST-ein34-mail", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore,async()=>{const result=await work();if(flushAfter){for(const close of closeCallbacks)close();await Promise.all(afterJobs);if(afterErrors.length)throw new AggregateError(afterErrors,'TEST_NEXT_AFTER_FAILED');}return result;}));
}

async function withSession<T>(fixture: Fixture, work: () => Promise<T>,flushAfter=false): Promise<T> {
  const { COOKIE_NAME, getSecretKey, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId: fixture.actorId,
    tenantId: KREILE_TENANT_SLUG,
    role: fixture.role,
    displayName: "TEST Mail Import",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work,flushAfter);
}

async function createFixture(rights: string[],role:AppSession['role']='meister'): Promise<Fixture> {
  const actorId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`TEST-ein34-mail-${actorId}@local.invalid`},
        'TEST Mail Import', ${role}, true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${rights}::text[]) area
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("ABLAUF_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, role };
}


export {sql,full,withSession,nativeFetch,storageApi,createFixture};

afterEach(()=>{vi.restoreAllMocks();});
