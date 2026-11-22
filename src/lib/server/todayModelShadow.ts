import 'server-only';
import {sql} from 'drizzle-orm';
import {TODAY_PROJECTOR_VERSION} from '@/lib/today/todayModelContract';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import {scheduleTodayProjection} from './todayProjectionSchedule';

type Counts=Record<string,number|null>;
type ShadowRow={kind:string;fresh:boolean;rebuild:boolean;counts:Counts};
const count=(path:string[])=>{
 const value=sql`source.payload #> ARRAY[${sql.join(path.map(key=>sql`${key}`),sql`, `)}]::text[]`;
 return sql`CASE WHEN jsonb_typeof(${value})='array' THEN jsonb_array_length(${value}) ELSE NULL END`;
};

/** Dark diagnostic only. No model data replaces the live dashboard. Query and
 * log carry counts, never original payloads, money values, names or identities. */
export async function observeTodayModelShadow(auth:{tenantId:string},today:string,live:Counts){
 try{
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
  if(!rows.length||rows.some(row=>row.rebuild===true))await scheduleTodayProjection([auth.tenantId],'rebuild');
 }catch{console.error('[TODAY_MODEL_SHADOW_FAILED]',{code:'SOURCE_INCOMPLETE'});}
}
