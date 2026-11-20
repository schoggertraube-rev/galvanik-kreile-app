// @vitest-environment node
// Actual canonical tenant, request/Auth, Actions and DB. Only initial TEST logins are synthetic.
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import postgres from 'postgres';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {ROLE_ACCESS_AREA_TEMPLATES,type AppRole} from '@/lib/auth/authorizationContract';
import type {AppSession} from '@/lib/server/appSession';

(globalThis as typeof globalThis&{AsyncLocalStorage:typeof AsyncLocalStorage}).AsyncLocalStorage=AsyncLocalStorage;
vi.setConfig({testTimeout:60000,hookTimeout:60000});
const database=process.env.DATABASE_URL;
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||!['postgres:','postgresql:'].includes(new URL(database).protocol)||new URL(database).username!=='postgres'||new URL(database).pathname!=='/postgres')throw Error('S19_SOURCE_OWN_LOOPBACK_REQUIRED');
if(process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('S19_SOURCE_NO_REMOTE_STORAGE_KEY');
const sql=postgres(database,{max:2,prepare:false}),originalSecret=process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET='TEST-S19-source-'+randomUUID();
type Actor={id:string;role:AppRole;issuedAt:number};
const actors:Actor[]=[];
let customerId:string,orderId:string,quoteId:string,itemId:string;

// Same Next request-store seam as the existing canonical H18 tests; no Auth mock.
async function request<T>(actor:Actor,work:()=>Promise<T>):Promise<T>{
 const {NextRequest}=await import('next/server');
 const {createRequestStoreForAPI}=await import('next/dist/server/async-storage/request-store');
 const {workAsyncStorage}=await import('next/dist/server/app-render/work-async-storage.external');
 const {workUnitAsyncStorage}=await import('next/dist/server/app-render/work-unit-async-storage.external');
 const {COOKIE_NAME,getSecretKey,signAppSession}=await import('@/lib/server/appSession');
 const session:AppSession={userId:actor.id,tenantId:KREILE_TENANT_SLUG,role:actor.role,displayName:'TEST S19 source',issuedAt:actor.issuedAt,expiresAt:actor.issuedAt+3600000};
 const incoming=new NextRequest('http://127.0.0.1/TEST-s19-source',{headers:{cookie:COOKIE_NAME+'='+signAppSession(session,getSecretKey())}});
 const store={isStaticGeneration:false,page:'/TEST-s19-source',route:'/TEST-s19-source',afterContext:{},previouslyRevalidatedTags:[],refreshTagsByCacheKind:new Map(),shouldTrackFetchMetrics:false,deploymentId:'test',buildId:'test',incrementalCache:{},cacheComponentsEnabled:false,runInCleanSnapshot:(fn:(...args:never[])=>unknown,...args:never[])=>fn(...args),reactServerErrorsByDigest:new Map()} as unknown as import('next/dist/server/app-render/work-async-storage.external').WorkStore;
 const requestStore=createRequestStoreForAPI(incoming,{pathname:'/TEST-s19-source',search:''},{tags:[],expirationsByCacheKind:new Map()},undefined,undefined as never);
 return workAsyncStorage.run(store,()=>workUnitAsyncStorage.run(requestStore,work));
}

beforeAll(async()=>{
 for(const role of ['meister','buero','werkstatt'] as const){
  const actor={id:randomUUID(),role,issuedAt:Date.now()};actors.push(actor);
  await sql`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,created_at,updated_at)
   VALUES(${actor.id}::uuid,${KREILE_TENANT_SLUG},${'TEST-S19-source-'+actor.id+'@example.invalid'},${'TEST S19 '+role},${role},true,${new Date(actor.issuedAt-5000).toISOString()}::timestamptz,${new Date(actor.issuedAt-5000).toISOString()}::timestamptz)`;
  for(const area of ROLE_ACCESS_AREA_TEMPLATES[role])await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${actor.id}::uuid,${area},${actor.id}::uuid)`;
 }
 const {createCustomerAction}=await import('@/app/actions/customers.actions');
 const customer=await request(actors[0],()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST S19 Bausteinquelle '+randomUUID(),salutation:'ohne',firstName:'TEST',lastName:'Baustein',phone:'+49 711 5550190',email:'TEST-s19@example.invalid',street:'TEST Weg',houseNumber:'1',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse'}));
 expect(customer.code).toBe('OK');if(customer.code!=='OK')throw Error('S19_CUSTOMER_ACTION:'+customer.code);
 customerId=customer.customer.id;
 const {createOrderIntakeAction,saveIntakeNoteAction}=await import('@/app/actions/eingang.actions');
 const order=await request(actors[0],()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'vorkasse',note:'TEST S19 Originalauftrag',items:[{catalogServiceId:null,name:'TEST S19 Flansch',quantity:2,material:'Stahl',surfaceRequested:'Verzinken',executionRequested:'offen',unit:'Stück',unitPriceCents:12500,vatRateBasisPoints:1900}]}));
 expect(order.code).toBe('OK');if(order.code!=='OK')throw Error('S19_ORDER_ACTION:'+order.code);
 orderId=order.receipt.orderId;
 const {changeOrderPromisedDueDateAction}=await import('@/app/actions/orders.actions');
 expect(await request(actors[0],()=>changeOrderPromisedDueDateAction({orderId,expectedVersion:order.receipt.orderVersion,dueDate:'2027-05-16',reason:'TEST S19 echte Terminänderung',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const {createQuoteAction}=await import('@/app/actions/quotes.actions');
 const quote=await request(actors[0],()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S19 Original-KV',positions:[{name:'TEST S19 Flansch',quantity:2,material:'Stahl',surfaceRequested:'Verzinken',unitPriceCents:12500}]}));
 expect(quote.code).toBe('OK');if(quote.code!=='OK')throw Error('S19_QUOTE_ACTION:'+quote.code);
 quoteId=quote.quote.quoteId;itemId=randomUUID();
 expect(await request(actors[0],()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST S19 Originalnotiz zum Flansch',context:{customerId,orderId}}))).toMatchObject({code:'OK'});
});

afterAll(async()=>{
 try{for(const actor of actors)await sql`UPDATE public.app_users SET active=false,updated_at=statement_timestamp() WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${actor.id}::uuid AND email=${'TEST-S19-source-'+actor.id+'@example.invalid'}`;}
 finally{await sql.end({timeout:3});if(originalSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=originalSecret;}
});

it('prepares actual TEST action originals for component inspection without a tenant override or fixture HTML',async()=>{
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const {getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const {readQuoteAction}=await import('@/app/actions/quotes.actions');
 const {getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 const card=await request(actors[0],()=>getLiveOrderCardAction({orderId}));
 expect(card).toMatchObject({code:'OK',data:{card:{id:orderId,customerId,items:[{name:'TEST S19 Flansch',quantity:2}]}}});
 if(card.code!=='OK')throw Error('S19_CARD_READ');expect(card.data.card.dueDateChanges).toHaveLength(1);
 expect(await request(actors[0],()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{id:customerId}});
 expect(await request(actors[0],()=>readQuoteAction({quoteId,purpose:'operations'}))).toMatchObject({code:'OK',quote:{quoteId,customerId}});
 expect(await request(actors[0],()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{id:itemId,text:'TEST S19 Originalnotiz zum Flansch'}});
 for(const actor of actors)expect(await request(actor,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId}}});
 writeFileSync('.git/kreile-s19-source-fixture-current.json',JSON.stringify({at:new Date().toISOString(),canonicalTenant:KREILE_TENANT_SLUG,customerId,orderId,quoteId,itemId,sourceVersion:card.data.card.version,actualActionsAuthDB:true,syntheticInitialLogins:true,browserDone:false},null,2));
});
