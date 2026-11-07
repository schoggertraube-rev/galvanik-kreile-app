// @vitest-environment node
// TEST provider boundary only. Server action, authorization, Replay DB and Storage are real.
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import postgres from 'postgres';
import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import type {AppSession} from '@/lib/server/appSession';
(globalThis as typeof globalThis & {AsyncLocalStorage:typeof AsyncLocalStorage}).AsyncLocalStorage=AsyncLocalStorage;
vi.setConfig({testTimeout:60000,hookTimeout:60000});
const database=process.env.DATABASE_URL;
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/postgres')throw Error('EIN34_DEDICATED_LOCAL_REPLAY_REQUIRED');
const sql=postgres(database,{max:2,prepare:false});
const originalEnv={...process.env};
const nativeFetch=globalThis.fetch;
type Fixture={actorId:string;actorIssuedAt:number};
let full:Fixture,restricted:Fixture;
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
 full=await createFixture(['eingang','mails','kunden','auftraege']);restricted=await createFixture(['eingang','kunden']);
});
afterAll(async()=>{vi.restoreAllMocks();for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];Object.assign(process.env,originalEnv);await sql.end({timeout:5});});
async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/TEST-ein34-mail", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/TEST-ein34-mail",
    route: "/TEST-ein34-mail",
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
    { pathname: "/TEST-ein34-mail", search: "" },
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
    displayName: "TEST Mail Import",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(rights: string[]): Promise<Fixture> {
  const actorId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`TEST-ein34-mail-${actorId}@local.invalid`},
        'TEST Mail Import', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
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
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("AP01_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt };
}


it('imports one MIME + inline/non-inline originals via the real UI action, rereads DB/events/Storage/view and never duplicates or hides them on provider failure',async()=>{
 const run=randomUUID(),graphId='TEST-graph-'+run,internetId='<TEST-'+run+'@example.invalid>';
 const photo=Buffer.alloc(16000,7),smallPhoto=Buffer.alloc(200,8),logo=Buffer.from('TEST-logo');
 const mime=Buffer.from('From: TEST Kunde <test-'+run+'@example.invalid>\r\nMessage-ID: '+internetId+'\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=TEST\r\n\r\n--TEST\r\nContent-Type: text/plain\r\n\r\nTEST Bitte Angebot erstellen\r\n--TEST\r\nContent-Type: image/png\r\nContent-Transfer-Encoding: base64\r\n\r\n'+photo.toString('base64')+'\r\n--TEST--\r\n');
 let offline=false,providerCalls=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url.startsWith('https://login.microsoftonline.com/'))return new Response(JSON.stringify({access_token:'TEST-provider-token'.repeat(3)}),{status:200});
  if(url.startsWith('https://graph.microsoft.com/')){
   providerCalls++;
   if(offline)return new Response(JSON.stringify({error:{code:'TEST_OFFLINE'}}),{status:503});
   if(url.includes('/$value'))return new Response(mime.toString('utf8'),{status:200});
   if(url.includes('/attachments'))return new Response(JSON.stringify({value:[
    {id:'TEST-photo',name:'TEST-Teil.png',contentType:'image/png',isInline:true,contentId:'TEST-part',size:photo.length,contentBytes:photo.toString('base64')},
    {id:'TEST-small',name:'TEST-Etikett.png',contentType:'image/png',isInline:false,size:smallPhoto.length,contentBytes:smallPhoto.toString('base64')},
    {id:'TEST-logo',name:'TEST-Signatur.png',contentType:'image/png',isInline:true,contentId:'TEST-signature',size:logo.length,contentBytes:logo.toString('base64')}
   ]}),{status:200});
   return new Response(JSON.stringify({value:[{id:graphId,internetMessageId:internetId,subject:'TEST Mail Import '+run,from:{emailAddress:{name:'TEST Kunde',address:'test-'+run+'@example.invalid'}},receivedDateTime:'2026-11-07T10:00:00Z',bodyPreview:'TEST Bitte Angebot erstellen',body:{contentType:'text',content:'TEST Bitte Angebot erstellen'},hasAttachments:false}]}),{status:200});
  }
  return nativeFetch(input,init);
 });
 const {getOpenIntakeMailsAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 const denied=await withSession(restricted,()=>getOpenIntakeMailsAction());
 expect(denied.code).toBe('FORBIDDEN');expect(providerCalls).toBe(0);
 const first=await withSession(full,()=>getOpenIntakeMailsAction());
 expect(first.code).toBe('OK');if(first.code!=='OK')throw Error(first.message);
 expect(first.notice).toBeUndefined();
 const [row]=await sql`SELECT id::text,graph_message_id,text,kanal FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${graphId}`;
 expect(row).toMatchObject({graph_message_id:graphId,kanal:'mail',text:'TEST Bitte Angebot erstellen'});
 expect(first.mails).toContainEqual(expect.objectContaining({id:row.id,fileCount:2}));
 const events=await sql`SELECT art,nachher FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${row.id}::uuid`;
 expect(events.filter(event=>event.art==='angelegt')).toHaveLength(1);expect(events.filter(event=>event.art==='original_gespeichert')).toHaveLength(3);
 const files=await sql`SELECT id::text,art,dateiname,mime,sha256,speicherpfad FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${row.id}::uuid`;
 expect(files).toHaveLength(3);expect(files.some(file=>file.art==='mime'&&file.mime==='message/rfc822')).toBe(true);expect(files.some(file=>file.dateiname.includes('Signatur'))).toBe(false);
 const {createAdminClient}=await import('@/lib/supabase/admin');
 for(const file of files){const downloaded=await createAdminClient().storage.from('scans').download(file.speicherpfad);expect(downloaded.error).toBeNull();const bytes=Buffer.from(await downloaded.data!.arrayBuffer());expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);if(file.art==='mime')expect(bytes.equals(mime)).toBe(true);}
 const capture=await withSession(full,()=>getIntakeCaptureAction(row.id));expect(capture).toMatchObject({code:'OK',capture:{id:row.id,files:expect.arrayContaining([expect.objectContaining({secured:true,mime:'message/rfc822'})])}});
 await withSession(full,()=>getOpenIntakeMailsAction());
 expect((await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${graphId}`).length).toBe(1);
 expect((await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${row.id}::uuid`).length).toBe(3);
 expect((await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${row.id}::uuid AND art='original_gespeichert'`).length).toBe(3);
 offline=true;
 const retained=await withSession(full,()=>getOpenIntakeMailsAction());expect(retained).toMatchObject({code:'OK',notice:expect.any(String),mails:expect.arrayContaining([expect.objectContaining({id:row.id})])});
});
