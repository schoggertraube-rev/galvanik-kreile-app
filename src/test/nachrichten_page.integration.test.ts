// @vitest-environment node
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {afterAll,expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';

(globalThis as typeof globalThis&{AsyncLocalStorage:typeof AsyncLocalStorage}).AsyncLocalStorage=AsyncLocalStorage;
const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||url!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres'||process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('MESSAGES_LOCAL_REPLAY_REQUIRED');
const sql=postgres(url,{max:1,prepare:false}),originalSecret=process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET='messages-page-isolated-replay-only';
afterAll(async()=>{await sql.end({timeout:1});if(originalSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=originalSecret;});

async function request<T>(actor:string|null,work:()=>Promise<T>){
 const {NextRequest}=await import('next/server');
 const {createRequestStoreForAPI}=await import('next/dist/server/async-storage/request-store');
 const {workAsyncStorage}=await import('next/dist/server/app-render/work-async-storage.external');
 const {workUnitAsyncStorage}=await import('next/dist/server/app-render/work-unit-async-storage.external');
 const {COOKIE_NAME,getSecretKey,signAppSession}=await import('@/lib/server/appSession');
 const cookie=actor?COOKIE_NAME+'='+await signAppSession({userId:actor,tenantId:KREILE_TENANT_SLUG,role:'meister',displayName:'SYNTHETISCH Nachrichten',issuedAt:Date.now(),expiresAt:Date.now()+300000},await getSecretKey()):'';
 const nextRequest=new NextRequest('http://127.0.0.1/nachrichten',{headers:{cookie}});
 const store=createRequestStoreForAPI(nextRequest,{pathname:'/nachrichten',search:''},{tags:[],expirationsByCacheKind:new Map()},undefined,undefined as never);
 const workStore={isStaticGeneration:false,page:'/nachrichten',route:'/nachrichten',previouslyRevalidatedTags:[],refreshTagsByCacheKind:new Map(),shouldTrackFetchMetrics:false,deploymentId:'test',buildId:'test',incrementalCache:{},cacheComponentsEnabled:false,runInCleanSnapshot:(fn:(...args:never[])=>unknown,...args:never[])=>fn(...args),reactServerErrorsByDigest:new Map()} as unknown as import('next/dist/server/app-render/work-async-storage.external').WorkStore;
 return workAsyncStorage.run(workStore,()=>workUnitAsyncStorage.run(store,work));
}

it('Nachrichten route: real session -> canonical note/mail row -> filter -> Info event -> reread; no shadow inbox',async()=>{
 const actor=randomUUID(),itemId=randomUUID(),text='SYNTHETISCH Nachrichten-Integration '+itemId;
 await sql`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,created_at,updated_at) VALUES(${actor}::uuid,${KREILE_TENANT_SLUG},${actor+'@fixture.invalid'},'SYNTHETISCH Nachrichten','meister',true,statement_timestamp()-interval '5 seconds',statement_timestamp()-interval '5 seconds')`;
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${actor}::uuid,'eingang',${actor}::uuid)`;
 const {saveIntakeNoteAction,getIntakeMessagesAction,finishIntakeUseAction}=await import('@/app/actions/eingang.actions');
 const {default:Page}=await import('@/app/nachrichten/page');
 const {proxy}=await import('@/proxy'),{NextRequest}=await import('next/server'),{cookies}=await import('next/headers');
 expect((await proxy(new NextRequest('http://127.0.0.1/nachrichten'))).status).toBe(307);
 const access=await request(actor,async()=>proxy(new NextRequest('http://127.0.0.1/nachrichten',{headers:{cookie:(await cookies()).toString()}})));
 expect(access.status).toBe(200);
 expect((await proxy(new NextRequest('http://127.0.0.1/nicht-stufe-1'))).status).toBe(404);
 const saved=await request(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text}));expect(saved).toMatchObject({code:'OK'});
 expect(await request(null,()=>getIntakeMessagesAction('alle'))).toMatchObject({code:'UNAUTHENTICATED'});
 expect(await request(actor,()=>getIntakeMessagesAction('alle'))).toMatchObject({code:'FORBIDDEN'});
 expect(await request(actor,()=>Page({searchParams:Promise.resolve({gruppe:itemId})}))).toMatchObject({props:{role:'alert'}});
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${actor}::uuid,'mails',${actor}::uuid)`;
 await sql`UPDATE public.intake_item SET kanal='mail',richtung='rein',absender_adresse=${actor+'@fixture.invalid'},betreff='SYNTHETISCH Mail',zuordnung='hand' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 const read=await request(actor,()=>getIntakeMessagesAction('offen'));if(read.code!=='OK')throw Error(JSON.stringify(read));
 expect(read.messages.find(row=>row.id===itemId)).toMatchObject({id:itemId,channel:'mail',text,usage:'offen',assignment:'hand',customerId:null,customerName:null,orderId:null,fileIds:[]});
 expect(read.areas).toEqual(expect.arrayContaining(['eingang','mails']));
 expect(await request(actor,()=>getIntakeMessagesAction({tenantId:'other'}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await request(actor,()=>Page({searchParams:Promise.resolve({gruppe:itemId})}))).toMatchObject({props:{initialGroup:itemId}});
 const input={items:[{itemId,version:1}],kind:'info',note:null,clientEventId:randomUUID()};
 expect(await request(actor,()=>finishIntakeUseAction(input))).toMatchObject({code:'OK'});
 expect(await sql`SELECT einsatz,anliegen_offen,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{einsatz:'info',anliegen_offen:[],version:2}]);
 expect(await sql`SELECT art FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${input.clientEventId}::uuid`).toEqual([{art:'einsatz'}]);
 const after=await request(actor,()=>getIntakeMessagesAction('erledigt'));if(after.code!=='OK')throw Error(JSON.stringify(after));expect(after.messages.find(row=>row.id===itemId)).toMatchObject({usage:'info',version:2});
 const remaining=await request(actor,()=>getIntakeMessagesAction('offen'));if(remaining.code!=='OK')throw Error(JSON.stringify(remaining));expect(remaining.messages.some(row=>row.id===itemId)).toBe(false);
},60000);
