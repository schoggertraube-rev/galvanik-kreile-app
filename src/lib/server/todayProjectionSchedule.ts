import 'server-only';
import {after} from 'next/server';
import {headers} from 'next/headers';
import {outsidePageReadBudget} from '@/db/readBudget';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from './privilegedDb';

/** Shared background-model contract: worker, freshness checks and scheduler. */
export const TODAY_PROJECTOR_VERSION=1;
export const TODAY_MODEL_LIST_KINDS=['orders','messages','money','complaints','quote_followups','quotes','tasks','company'] as const;

type Mode='refresh'|'rebuild';
type Shadow={auth:{tenantId:string};today:string;live:Counts};
type Jobs={scheduled:boolean;tenants:Map<string,Mode>;shadows:Map<string,Shadow>};
// Keyed only by Next's actual request-local headers object. No header value is
// read, no authorization is cached, and the weak entry dies with that request.
const requests=new WeakMap<object,Jobs>();

/** One native after job per request; a later stale-day shadow read upgrades an
 * already registered bounded refresh to rebuild instead of competing for its lease. */
export async function scheduleTodayProjection(tenantIds:readonly string[],mode:Mode){
 return queueTodayWork(tenantIds,mode);
}
async function queueTodayWork(tenantIds:readonly string[],mode?:Mode,shadow?:Shadow){
 try{
  const request=await headers();
  let jobs=requests.get(request);
  if(!jobs){jobs={scheduled:false,tenants:new Map(),shadows:new Map()};requests.set(request,jobs);}
  if(mode)for(const tenantId of tenantIds)if(mode==='rebuild'||!jobs.tenants.has(tenantId))jobs.tenants.set(tenantId,mode);
  if(shadow)jobs.shadows.set(shadow.auth.tenantId,shadow);
  if(jobs.scheduled)return;
  const pending=jobs;
  after(()=>outsidePageReadBudget(async()=>{
   const {refreshTodayModel,rebuildTodayModel}=await import('./todayProjection');
   for(const tenantId of new Set([...pending.tenants.keys(),...pending.shadows.keys()])){
    const requested=pending.tenants.get(tenantId),shadow=pending.shadows.get(tenantId);
    try{
     if(shadow)await refreshTodayModel(tenantId,undefined,{shadow:{today:shadow.today,live:shadow.live},requestedMode:requested});
     else await (requested==='rebuild'?rebuildTodayModel(tenantId):refreshTodayModel(tenantId));
    }
    catch{console.error('[TODAY_PROJECTOR_REFRESH_FAILED]',{code:'SOURCE_INCOMPLETE'});}
   }
  }));
  jobs.scheduled=true;
 }catch{console.error('[TODAY_PROJECTOR_SCHEDULE_FAILED]',{code:'SOURCE_INCOMPLETE'});}
}

type Counts=Record<string,number|null>;
type ShadowRow={kind:string;fresh:boolean;rebuild:boolean;counts:Counts};
const count=(path:string[])=>{
 const value=sql`source.payload #> ARRAY[${sql.join(path.map(key=>sql`${key}`),sql`, `)}]::text[]`;
 return sql`CASE WHEN jsonb_typeof(${value})='array' THEN jsonb_array_length(${value}) ELSE NULL END`;
};

/** Dark diagnostic only. No model data replaces the live dashboard. Query and
 * log carry counts, never original payloads, money values, names or identities. */
export async function observeTodayModelShadow(auth:{tenantId:string},today:string,live:Counts){
 // Capture count-only inputs now; all settings/claim/comparison SQL runs after
 // response close in the same coalesced native job as command refreshes.
 return queueTodayWork([],undefined,{auth:{tenantId:auth.tenantId},today,live:{...live}});
}
/** The sole projector composition root supplies the actual setting. */
export async function compareTodayModelShadow(auth:{tenantId:string},today:string,live:Counts,intervalMs:number):Promise<boolean>{
 try{
  const slot=await withPrivilegedTenantTransaction(auth,tx=>tx.execute(sql`INSERT INTO private.today_tenant_v1(tenant_id,shadow_checked_at)
   VALUES(${auth.tenantId},statement_timestamp())
   ON CONFLICT(tenant_id) DO UPDATE SET shadow_checked_at=EXCLUDED.shadow_checked_at
   WHERE today_tenant_v1.shadow_checked_at IS NULL OR today_tenant_v1.shadow_checked_at<=statement_timestamp()-interval '1 millisecond'*${intervalMs}
   RETURNING tenant_id`));
  if(!slot.length)return false;
  const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<ShadowRow>(sql`
   SELECT source.kind,
    source.status='OK' AND source.source_seq=source.built_seq AND source.built_tenant_seq=tenant.tenant_seq
     AND source.built_day=${today}::date AND source.projector_version=${TODAY_PROJECTOR_VERSION}
     AND (source.kind<>'order' OR source.listed AND orders.version=source.source_version) AS fresh,
    source.built_tenant_seq<>tenant.tenant_seq OR source.built_day IS DISTINCT FROM ${today}::date
     OR source.projector_version<>${TODAY_PROJECTOR_VERSION} AS rebuild,
    CASE source.kind
     WHEN 'orders' THEN jsonb_build_object('orders',${count([])})
     WHEN 'messages' THEN jsonb_build_object('messages',${count(['messages'])})
     WHEN 'money' THEN jsonb_build_object('invoices',${count(['invoiceSource','data'])},'prepayments',${count(['prepaymentSource','data'])},'collections',${count(['collectionSource','data'])},'invoiceMailGroups',${count(['invoiceMailSource','data','groups'])})
     WHEN 'complaints' THEN jsonb_build_object('complaints',${count(['complaints'])})
     WHEN 'quote_followups' THEN jsonb_build_object('quoteFollowups',${count([])})
     WHEN 'quotes' THEN jsonb_build_object('quotes',${count(['list','quotes'])})
     WHEN 'tasks' THEN jsonb_build_object('tasks',${count(['rows'])})
     WHEN 'company' THEN jsonb_build_object('company',CASE WHEN source.payload->>'code'='OK' THEN 1 ELSE NULL END)
     ELSE '{}'::jsonb END AS counts
   FROM private.today_source_v1 source JOIN private.today_tenant_v1 tenant USING(tenant_id)
   LEFT JOIN public.orders orders ON source.kind='order' AND orders.tenant_id=source.tenant_id AND orders.id=source.source_id
   WHERE source.tenant_id=${auth.tenantId} AND (source.kind='order' AND source.listed OR source.source_id='*')
   ORDER BY source.kind,source.source_id`));
  const model:Counts=Object.fromEntries(Object.keys(live).map(key=>[key,null]));
  for(const row of rows)if(row.fresh===true)for(const [key,value] of Object.entries(row.counts)){
   if(key in model&&live[key]!==null&&Number.isSafeInteger(value)&&Number(value)>=0)model[key]=value;
  }
  if(model.orders!==null&&live.orderCards!==null)model.orderCards=rows.filter(row=>row.kind==='order'&&row.fresh===true).length;
  const keys=Object.keys(live),comparable=keys.filter(key=>live[key]!==null&&model[key]!==null);
  console.info('[TODAY_MODEL_SHADOW]',JSON.stringify({version:TODAY_PROJECTOR_VERSION,live,model,compared:comparable.length,different:comparable.filter(key=>live[key]!==model[key]).length,unknown:keys.length-comparable.length,stale:rows.filter(row=>row.fresh!==true).length}));
  return !rows.length||rows.some(row=>row.rebuild===true);
 }catch{console.error('[TODAY_MODEL_SHADOW_FAILED]',{code:'SOURCE_INCOMPLETE'});return false;}
}
