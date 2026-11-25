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

it('Lagerbuchen und Preise & Rechnungen können mit getrennten Rechten dieselbe Aufgabe anlegen und erledigen',async()=>{
 const {NextRequest}=await import('next/server');
 const {createRequestStoreForAPI}=await import('next/dist/server/async-storage/request-store');
 const {workAsyncStorage}=await import('next/dist/server/app-render/work-async-storage.external');
 const {workUnitAsyncStorage}=await import('next/dist/server/app-render/work-unit-async-storage.external');
 const {COOKIE_NAME,getSecretKey,signAppSession}=await import('@/lib/server/appSession');
 const {resolveAuthorization}=await import('@/lib/server/authorization');
 const {hasAuthorizationArea,hasLagerCapability}=await import('@/lib/auth/authorizationContract');
 const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');
 const {readCustomerProfile}=await import('@/modules/customers/server-public');
 const {recordIntakeTaskEffect,readIntakeMessagesForAuthorization,projectIntakeMessageSources}=await import('@/modules/eingang/server-public');
 const {getIntakeCaptureAction,getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
 const {authorizationReadContext}=await import('@/lib/server/authorizationReadContext');
 const {completeTask,synchronizeLagerPreisTask}=await import('@/modules/tasks/server-public');

 const route='/test-lagerpreis';
 const workStore={isStaticGeneration:false,page:route,route,afterContext:{},previouslyRevalidatedTags:[],
  refreshTagsByCacheKind:new Map(),shouldTrackFetchMetrics:false,deploymentId:'test',buildId:'test',incrementalCache:{},
  cacheComponentsEnabled:false,runInCleanSnapshot:(fn:(...args:never[])=>unknown,...args:never[])=>fn(...args),
  reactServerErrorsByDigest:new Map(),} as unknown as import('next/dist/server/app-render/work-async-storage.external').WorkStore;
 const createLogin=async(role:'werkstatt'|'readonly',rights:readonly ('eingang'|'preise'|'mails')[])=>{
  const userId=randomUUID();
  await sql`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,updated_at)
   VALUES(${userId}::uuid,${mandant},${userId+'@local.invalid'},'TEST Lagerpreise',${role},true,statement_timestamp()-interval '1 second')`;
  for(const right of rights)await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${mandant},${userId}::uuid,${right},${userId}::uuid)`;
  return {userId,role};
 };
 type Actor=Parameters<typeof synchronizeLagerPreisTask>[1];
 const withLogin=async<T>(login:Awaited<ReturnType<typeof createLogin>>,work:(auth:Actor)=>Promise<T>):Promise<T>=>{
  const cookie=signAppSession({...login,tenantId:mandant,displayName:'TEST Lagerpreise',issuedAt:Date.now(),
   expiresAt:Date.now()+300_000},getSecretKey());
  const request=new NextRequest('http://127.0.0.1'+route,{headers:{cookie:COOKIE_NAME+'='+cookie}});
  const requestStore=createRequestStoreForAPI(request,{pathname:route,search:''},{tags:[],expirationsByCacheKind:new Map()},undefined,undefined as never);
  return workAsyncStorage.run(workStore,()=>workUnitAsyncStorage.run(requestStore,async()=>{
   const session=await resolveAuthorization();
   if(!session.ok)throw Error('TEST_REAL_AUTH_REQUIRED: '+session.reason);
   return work(session.data);
  }));
 };
 const lager=await createLogin('werkstatt',['eingang','mails']);
 const preise=await createLogin('readonly',['preise','eingang','mails']);
 const artikelId='TEST-B3A-'+randomUUID();
 await sql`INSERT INTO public.inventory_items(id,tenant_id,name,basiseinheit,stamm_status)
  VALUES(${artikelId},${mandant},'TEST Schleifmittel','stk','aktiv')`;

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
 const synchronize=(auth:Actor)=>withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerPreisTask(tx,auth,artikelId,'stk',deps));
 const [first,retry]=await withLogin(lager,auth=>{
  expect(hasLagerCapability(auth,'lager.buchen')).toBe(true);
  expect(hasAuthorizationArea(auth,'preise')).toBe(false);
  return Promise.all([synchronize(auth),synchronize(auth)]);
 });
 expect(first).toEqual(expect.any(String));
 expect(retry).toBe(first);
 const taskRows=()=>sql`SELECT id::text,version,titel,status,fuer_bereich,erstellt_von::text,erledigt_von::text FROM public.tasks
  WHERE tenant_id=${mandant} AND bezug_typ='lagerartikel' AND bezug_id=${artikelId}`;
 const open=await taskRows();
 expect(open).toEqual([{id:first,version:1,titel:'Preis für TEST Schleifmittel je stk hinterlegen',status:'offen',fuer_bereich:'preise',
  erstellt_von:lager.userId,erledigt_von:null}]);
 async function expectGeschuetztenBeleg(action:'aufgabe.angelegt'|'aufgabe.erledigt',actorId:string){
  const [beleg]=await sql<{id:string;actorId:string;text:string;priceText:string;reference:string}[]>`
   SELECT item.id::text,event.von::text AS "actorId",item.text,event.nachher->>'text' AS "priceText",event.nachher->>'bezugId' AS reference
   FROM public.intake_item item JOIN public.intake_event event ON event.tenant_id=item.tenant_id AND event.item_id=item.id
   WHERE item.tenant_id=${mandant} AND event.art='einsatz' AND event.nachher->>'taskId'=${first}
    AND event.nachher->>'action'=${action} AND event.nachher->>'fuerBereich'='preise'`;
  expect(beleg).toMatchObject({actorId,text:'',reference:artikelId});
  expect(beleg.priceText).toContain(open[0].titel);
  const commonSource=await withLogin(preise,async auth=>{
   const list=await getIntakeMessagesAction('alle');
   expect(list.code).toBe('OK');
   if(list.code!=='OK')throw Error('TEST_INTAKE_MESSAGES_REQUIRED');
   expect(list.messages.find(row=>row.id===beleg.id)?.text).toBe(beleg.priceText);
   expect(await getIntakeCaptureAction(beleg.id)).toMatchObject({code:'OK',capture:{text:beleg.priceText}});
   return readIntakeMessagesForAuthorization(authorizationReadContext(auth),'alle');
  });
  await withLogin(lager,async auth=>{
   const list=await getIntakeMessagesAction('alle');
   expect(list.code).toBe('OK');
   if(list.code!=='OK')throw Error('TEST_INTAKE_MESSAGES_REQUIRED');
   expect(list.messages.some(row=>row.id===beleg.id)).toBe(false);
   expect(JSON.stringify(list)).not.toContain(artikelId);
   expect(await getIntakeCaptureAction(beleg.id)).toMatchObject({code:'NOT_FOUND'});
   const projected=projectIntakeMessageSources(auth,commonSource);
   expect(projected.code).toBe('OK');
   if(projected.code!=='OK')throw Error('TEST_INTAKE_MESSAGES_REQUIRED');
   expect(projected.messages.some(row=>row.id===beleg.id)).toBe(false);
   expect(JSON.stringify(projected)).not.toContain(beleg.priceText);
  });
 }
 await expectGeschuetztenBeleg('aufgabe.angelegt',lager.userId);
 await withLogin(preise,async auth=>{
  expect(hasAuthorizationArea(auth,'preise')).toBe(true);
  expect(hasLagerCapability(auth,'lager.buchen')).toBe(false);
  const unchanged=await completeTask({taskId:first,version:1,note:null},{effect:deps.effect});
  expect(unchanged).toEqual({code:'FORBIDDEN',message:'Aufgabe ist für diesen Login nicht freigegeben.'});
  expect(await withPrivilegedTenantTransaction(auth,async tx=>{
   await tx.execute(query`INSERT INTO public.material_prices(tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am)
    VALUES(${mandant},${artikelId},3.4,'EUR','import',statement_timestamp(),statement_timestamp())`);
   return synchronizeLagerPreisTask(tx,auth,artikelId,'stk',deps);
  })).toBe(first);
  expect(await synchronize(auth)).toBeNull();
 });
 expect(await taskRows()).toEqual([{...open[0],version:2,status:'erledigt',erledigt_von:preise.userId}]);
 await expectGeschuetztenBeleg('aufgabe.erledigt',preise.userId);
},60_000);
