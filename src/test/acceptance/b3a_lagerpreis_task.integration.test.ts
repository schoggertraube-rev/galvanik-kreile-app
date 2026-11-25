// @vitest-environment node
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {sql as query} from 'drizzle-orm';
import postgres from 'postgres';
import {afterAll,expect,it,vi} from 'vitest';

const mandant=vi.hoisted(()=>'TEST-ablauf-lagerpreis-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:mandant}));

const url=process.env.DATABASE_URL;
const requiredPort=process.env.GITHUB_ACTIONS==='true'?'54322':'54342';
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL)throw Error('B3A_DEDICATED_LOOPBACK_REQUIRED');
const database=new URL(url);
if(database.hostname!=='127.0.0.1'||database.port!==requiredPort||database.pathname!=='/postgres'||!mandant.startsWith('TEST-ablauf-')){
 throw Error('B3A_DEDICATED_LOOPBACK_REQUIRED');
}
const sql=postgres(url,{max:2,prepare:false});
(globalThis as typeof globalThis&{AsyncLocalStorage:typeof AsyncLocalStorage}).AsyncLocalStorage=AsyncLocalStorage;
vi.stubEnv('APP_SESSION_SECRET',randomUUID());
afterAll(async()=>{vi.unstubAllEnvs();await sql.end({timeout:5});});

it('ein Fehlpreis erzeugt auch bei paralleler Wiederholung nur eine Aufgabe und der bestätigte Preis beendet sie',async()=>{
 const {NextRequest}=await import('next/server');
 const {createRequestStoreForAPI}=await import('next/dist/server/async-storage/request-store');
 const {workAsyncStorage}=await import('next/dist/server/app-render/work-async-storage.external');
 const {workUnitAsyncStorage}=await import('next/dist/server/app-render/work-unit-async-storage.external');
 const {COOKIE_NAME,getSecretKey,signAppSession}=await import('@/lib/server/appSession');
 const {resolveAuthorization}=await import('@/lib/server/authorization');
 const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');
 const {readCustomerProfile}=await import('@/modules/customers/server-public');
 const {recordIntakeTaskEffect}=await import('@/modules/eingang/server-public');
 const {completeTask,synchronizeLagerPreisTask}=await import('@/modules/tasks/server-public');

 const userId=randomUUID();
 await sql`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,updated_at)
  VALUES(${userId}::uuid,${mandant},${userId+'@local.invalid'},'TEST Lagerpreise','buero',true,statement_timestamp()-interval '1 second')`;
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by)
  SELECT ${mandant},${userId}::uuid,bereich,${userId}::uuid FROM unnest(ARRAY['lager.stamm','preise']) AS bereich`;
 const cookie=signAppSession({userId,tenantId:mandant,role:'buero',displayName:'TEST Lagerpreise',issuedAt:Date.now(),
  expiresAt:Date.now()+300_000},getSecretKey());
 const route='/test-lagerpreis';
 const request=new NextRequest('http://127.0.0.1'+route,{headers:{cookie:COOKIE_NAME+'='+cookie}});
 const requestStore=createRequestStoreForAPI(request,{pathname:route,search:''},{tags:[],expirationsByCacheKind:new Map()},undefined,undefined as never);
 const workStore={isStaticGeneration:false,page:route,route,afterContext:{},previouslyRevalidatedTags:[],
  refreshTagsByCacheKind:new Map(),shouldTrackFetchMetrics:false,deploymentId:'test',buildId:'test',incrementalCache:{},
  cacheComponentsEnabled:false,runInCleanSnapshot:(fn:(...args:never[])=>unknown,...args:never[])=>fn(...args),
  reactServerErrorsByDigest:new Map(),} as unknown as import('next/dist/server/app-render/work-async-storage.external').WorkStore;
 const artikelId='TEST-B3A-'+randomUUID();
 await sql`INSERT INTO public.inventory_items(id,tenant_id,name,basiseinheit,stamm_status)
  VALUES(${artikelId},${mandant},'TEST Schleifmittel','stk','aktiv')`;

 await workAsyncStorage.run(workStore,()=>workUnitAsyncStorage.run(requestStore,async()=>{
  const session=await resolveAuthorization();
  if(!session.ok)throw Error('TEST_REAL_AUTH_REQUIRED: '+session.reason);
  const auth=session.data;
  const deps:Parameters<typeof synchronizeLagerPreisTask>[4]={
   effect:(tx,from,input)=>recordIntakeTaskEffect(tx,from,input,readCustomerProfile),
   // Isolierte TEST-Quelle mit festem Stamm-Einheitwert. Der B3-a-Preisleser wird im Folge-PR angebunden.
   lesePreisstand:async(tx,id,einheit)=>{
    const [artikel]=await tx.execute<{artikelName:string}>(query`
     SELECT name AS "artikelName" FROM public.inventory_items
     WHERE tenant_id=${mandant} AND id=${id} AND basiseinheit=${einheit} FOR UPDATE
    `);
    if(!artikel)return null;
    const [stand]=await tx.execute<{preisVorhanden:boolean}>(query`
     SELECT EXISTS (SELECT 1 FROM public.material_prices
      WHERE tenant_id=${mandant} AND artikel_id=${id} AND bestaetigt_am IS NOT NULL) AS "preisVorhanden"
    `);
    return {...artikel,preisVorhanden:stand.preisVorhanden};
   },
  };
  const synchronize=()=>withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerPreisTask(tx,auth,artikelId,'stk',deps));
  const [first,retry]=await Promise.all([synchronize(),synchronize()]);
  expect(first).toEqual(expect.any(String));
  expect(retry).toBe(first);
  const taskRows=()=>sql`SELECT id::text,version,titel,status,fuer_bereich FROM public.tasks
   WHERE tenant_id=${mandant} AND bezug_typ='lagerartikel' AND bezug_id=${artikelId}`;
  const open=await taskRows();
  expect(open).toEqual([{id:first,version:1,titel:'Preis für TEST Schleifmittel je stk hinterlegen',status:'offen',fuer_bereich:'preise'}]);
  const unchanged=await completeTask({taskId:first,version:1,note:null},{effect:deps.effect});
  expect(unchanged.code).toBe('FORBIDDEN');

  await sql`INSERT INTO public.material_prices(tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am)
   VALUES(${mandant},${artikelId},3.4,'EUR','import',statement_timestamp(),statement_timestamp())`;
  expect(await synchronize()).toBe(first);
  expect(await synchronize()).toBeNull();
  expect(await taskRows()).toEqual([{...open[0],version:2,status:'erledigt'}]);
 }));
},60_000);
