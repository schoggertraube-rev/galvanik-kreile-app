// @vitest-environment node
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {sql} from 'drizzle-orm';
import {beforeAll,afterAll,describe,expect,it} from 'vitest';
import {db} from '@/db';
import {foldedSqlText} from '@/lib/server/searchTextSql';
import {foldSearchText} from '@/lib/domain/searchText';
import {searchFoldCases} from '@/lib/domain/__tests__/searchFoldCases';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import type {AppSession} from '@/lib/server/appSession';

(globalThis as typeof globalThis & {AsyncLocalStorage:typeof AsyncLocalStorage}).AsyncLocalStorage=AsyncLocalStorage;
const url=process.env.DATABASE_URL;
const expected=[process.env.P3_SEARCH_EXPECTED_DATABASE_URL,process.env.H18_EXPECTED_DATABASE_URL].filter(Boolean);
if(!url||!expected.includes(url))throw Error('SUCHREGEL_LOCAL_DATABASE_REQUIRED');
const address=new URL(url);
if(address.protocol!=='postgresql:'||address.hostname!=='127.0.0.1'||address.pathname!=='/postgres'||address.username!=='postgres'||process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('SUCHREGEL_LOCAL_DATABASE_REQUIRED');
const native=postgres(url,{max:2,prepare:false});
const userId=randomUUID(),suffix=randomUUID(),secret='suchregel-local-test-only';
const originalSecret=process.env.APP_SESSION_SECRET;
let sessionIssuedAt=0;
process.env.APP_SESSION_SECRET=secret;

async function withRequest<T>(cookie:string|null,work:()=>Promise<T>):Promise<T>{
 const {NextRequest}=await import('next/server');
 const {createRequestStoreForAPI}=await import('next/dist/server/async-storage/request-store');
 const {workAsyncStorage}=await import('next/dist/server/app-render/work-async-storage.external');
 const {workUnitAsyncStorage}=await import('next/dist/server/app-render/work-unit-async-storage.external');
 const request=new NextRequest('http://127.0.0.1/suchregel-test',{headers:cookie?{cookie}:undefined});
 const workStore={isStaticGeneration:false,page:'/suchregel-test',route:'/suchregel-test',afterContext:{},previouslyRevalidatedTags:[],refreshTagsByCacheKind:new Map(),shouldTrackFetchMetrics:false,deploymentId:'test',buildId:'test',cacheComponentsEnabled:false,runInCleanSnapshot:(fn:(...args:never[])=>unknown,...args:never[])=>fn(...args),reactServerErrorsByDigest:new Map()} as unknown as import('next/dist/server/app-render/work-async-storage.external').WorkStore;
 const requestStore=createRequestStoreForAPI(request,{pathname:'/suchregel-test',search:''},{tags:[],expirationsByCacheKind:new Map()},undefined,undefined as never);
 return workAsyncStorage.run(workStore,()=>workUnitAsyncStorage.run(requestStore,work));
}
async function withSession<T>(work:()=>Promise<T>):Promise<T>{
 const {COOKIE_NAME,getSecretKey,signAppSession}=await import('@/lib/server/appSession');
 const session:AppSession={userId,tenantId:KREILE_TENANT_SLUG,role:'meister',displayName:'TEST Suche',issuedAt:sessionIssuedAt,expiresAt:Date.now()+300000};
 return withRequest(`${COOKIE_NAME}=${signAppSession(session,getSecretKey())}`,work);
}
beforeAll(async()=>{
 const updatedAt=new Date(Date.now()-5000).toISOString();
 await native`INSERT INTO public.app_users (id,tenant_id,email,full_name,role,active,created_at,updated_at) VALUES (${userId}::uuid,${KREILE_TENANT_SLUG},${`suchregel-${suffix}@local.invalid`},'TEST Suche','meister',true,${updatedAt}::timestamptz,${updatedAt}::timestamptz)`;
 await native`INSERT INTO public.app_user_rights (tenant_id,user_id,bereich,granted_by) VALUES (${KREILE_TENANT_SLUG},${userId}::uuid,'auftraege',${userId}::uuid),(${KREILE_TENANT_SLUG},${userId}::uuid,'eingang',${userId}::uuid),(${KREILE_TENANT_SLUG},${userId}::uuid,'kunden',${userId}::uuid),(${KREILE_TENANT_SLUG},${userId}::uuid,'mails',${userId}::uuid),(${KREILE_TENANT_SLUG},${userId}::uuid,'preise',${userId}::uuid),(${KREILE_TENANT_SLUG},${userId}::uuid,'zahlungen',${userId}::uuid),(${KREILE_TENANT_SLUG},${userId}::uuid,'buchhaltung',${userId}::uuid) ON CONFLICT (tenant_id,user_id,bereich) DO UPDATE SET granted_by=EXCLUDED.granted_by`;
 sessionIssuedAt=Date.now();
});
afterAll(async()=>{await native.end({timeout:1});if(originalSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=originalSecret;});

describe('Eine Suchregel am echten TEST-Postgres',()=>{
 it.each(searchFoldCases)('SQL and TypeScript agree for %s',async(input,expected)=>{
  const result=await db.execute(sql`SELECT ${foldedSqlText(sql`${input}::text`)} AS wert`);
  expect(result[0]?.wert).toBe(expected);
  expect(result[0]?.wert).toBe(foldSearchText(input));
 });
 it('finds Mueller in customer and order, while treating pattern and filter syntax literally',async()=>{
  const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
  const created=await withSession(()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'NEW',name:`TEST Müller Größe ${suffix}`,customerType:'business',companyName:`TEST Müller Größe ${suffix}`,contactPerson:'TEST Suche',email:`suchregel-${suffix}@local.invalid`,phone:'+49 711 5550199',street:'TEST Straße 1',zipCode:'73728',city:'Esslingen',country:'Deutschland',paymentPreference:'vorkasse',vatId:null},dueDate:'2026-11-26',handoverMode:'pickup',paymentMode:'vorkasse',note:'TEST Suchregel',items:[{catalogServiceId:null,name:`TEST Größe ${suffix}`,quantity:2,material:'Stahl',surfaceRequested:'Verchromen',unit:null,unitPriceCents:null,vatRateBasisPoints:null}]}));
  expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('SUCHREGEL_TEST_INTAKE_FAILED');
  const {searchTenantAction}=await import('@/app/actions/search.actions');
  for(const query of [`Mueller Groesse ${suffix}`,`MÜLLER GRÖSSE ${suffix}`]){
   const found=await withSession(()=>searchTenantAction(query));
   expect(found.code).toBe('OK');if(found.code==='OK')expect(found.hits).toEqual(expect.arrayContaining([expect.objectContaining({id:created.receipt.customerId,type:'CUSTOMER'}),expect.objectContaining({id:created.receipt.orderId,type:'ORDER'})]));
  }
  const {searchCustomersDb}=await import('@/app/actions/customers.actions');
  for(const query of [`Mueller Groesse ${suffix}`,'MÜLLER','müller']){
   const result=await withSession(()=>searchCustomersDb(query));expect(result).toMatchObject({ok:true,data:expect.arrayContaining([expect.objectContaining({id:created.receipt.customerId})])});
  }
  for(const query of ['%','_',"') OR 1=1 --",'x,id.neq.0)']){
   const result=await withSession(()=>searchCustomersDb(query));expect(result).toMatchObject({ok:true,data:[]});
  }
 },30000);
});
