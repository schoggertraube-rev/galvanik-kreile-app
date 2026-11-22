import 'server-only';
import {sql} from 'drizzle-orm';
import {withPageReadPhase} from '@/db/readBudget';
import {canReadTaskArea,getFixedAccessAreasForRole,getPermissionsForAreas,isAccessArea,isAppRole,normalizeAccessAreasForRole,type AccessArea,type PermissionKey} from '@/lib/auth/authorizationContract';
import type {TodayReadSettings} from '@/modules/fundament/public';
import {readTodayReadSettings,readCompanyLetterSettings,readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
import {readCustomerProfile,readCustomerProfiles} from '@/modules/customers/server-public';
import {readInvoiceVat,readCustomerCreditInTransaction} from '@/modules/accounting/server-public';
import {readManualShippingBatch} from '@/modules/orders/server-public';
import {readComplaintsForAuthorization} from '@/modules/complaints/server-public';
import {readIntakeMessagesForAuthorization} from '@/modules/eingang/server-public';
import {listOpenQuotesCommand,readQuoteCommand,readQuoteActors} from '@/modules/quotes/server-public';
import {readTaskForAuthorization,readQuoteFollowupTasksForToday} from '@/modules/tasks/server-public';
import {paymentReadAuthorization,type PaymentReadProfile,type PaymentReadAuthorization} from './paymentContract';
import {readTodayOrderSources,type TodayOrderReadPorts} from './todayOrderRead';
import {readLiveOrderCardSource} from './orderCardRead';
import {getOperationalOrders} from './operationalOrders';
import {readTodayCalendar} from '@/lib/today/todayDashboardPolicy';
import {readTodayMoneySupport,todaySourceAccess} from './todayDashboard';
import {readShippingMergeAllocation} from './commands/immutableInvoiceCommand';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import {TODAY_PROJECTOR_VERSION,TODAY_MODEL_LIST_KINDS as TODAY_LIST_KINDS} from '@/lib/today/todayModelContract';
type TodaySourceKind='order'|typeof TODAY_LIST_KINDS[number];
const projectionBrand:unique symbol=Symbol('TodayReadOnlyProjector');
/** A read capability, never an AuthorizationSnapshot or a command identity. */
export type ProjectorAuthorization=Readonly<{tenantId:string;areas:readonly AccessArea[];permissions:readonly PermissionKey[];canReadArea:(area:AccessArea)=>boolean;canReadTaskArea:(area:AccessArea|null)=>boolean;payment:PaymentReadAuthorization;canReadOperationalQuotes:boolean;hasActiveProfiles:boolean;[projectionBrand]:true}>;
type TodaySourceKey=Readonly<{kind:TodaySourceKind;sourceId:string}>;
type TodayProjectionResult=
 | {code:'OK';payload:unknown;sourceVersion?:number;listed?:boolean}
 | {code:'GONE'}
 | {code:'SOURCE_INCOMPLETE';errorCode:string;payload?:unknown};
type TodayProjectionPorts={
 readSettings:(context:{tenantId:string})=>Promise<TodayReadSettings>;
 readSources:(authorization:ProjectorAuthorization,keys:readonly TodaySourceKey[])=>Promise<ReadonlyMap<string,TodayProjectionResult>>;
 listOrderIds:(authorization:ProjectorAuthorization)=>Promise<readonly string[]>;
};
const todaySourceKey=(key:TodaySourceKey)=>key.kind+':'+key.sourceId;
type Snapshot=TodaySourceKey&{sourceSeq:string;tenantSeq:string;day:string};
type Lease={token:string;tenantSeq:string;day:string};

/** Canonical area/role policy over the existing active user/rights source.
 * No new app_user, session, role, write grant or synthetic actor is created. */
async function projectorAuthorization(tenantId:string):Promise<ProjectorAuthorization>{
 const rows=await withPrivilegedTenantTransaction({tenantId},tx=>tx.execute<{role:string;active:boolean;areas:unknown}>(sql`
  SELECT actor.role,actor.active,(SELECT coalesce(array_agg(rights.bereich ORDER BY rights.bereich),ARRAY[]::text[])
   FROM public.app_user_rights rights WHERE rights.tenant_id=actor.tenant_id AND rights.user_id=actor.id) AS areas
  FROM public.app_users actor WHERE actor.tenant_id=${tenantId} AND actor.active ORDER BY actor.id`));
 const areas=new Set<AccessArea>();
 const profiles:PaymentReadProfile[]=[];
 for(const row of rows){
  if(!isAppRole(row.role)||row.active!==true||!Array.isArray(row.areas)||!row.areas.every(isAccessArea))throw Error('TODAY_PROJECTOR_RIGHTS_SOURCE_INVALID');
  const normalized=normalizeAccessAreasForRole(row.role,[...getFixedAccessAreasForRole(row.role),...row.areas]);
  profiles.push({tenantId,role:row.role,active:row.active,areas:normalized,permissions:getPermissionsForAreas(normalized)});
  for(const area of normalized)areas.add(area);
 }
 const union=Object.freeze([...areas].sort());
 const paymentProfiles=profiles.map(paymentReadAuthorization);
 return Object.freeze({tenantId,areas:union,permissions:Object.freeze([...getPermissionsForAreas(union)]),canReadArea:(area:AccessArea)=>areas.has(area),canReadTaskArea:(area:AccessArea|null)=>profiles.some(profile=>canReadTaskArea(profile,area)),
  payment:{tenantId,canReadSummary:context=>paymentProfiles.some(profile=>profile.canReadSummary(context)),canReadOrderStates:paymentProfiles.some(profile=>profile.canReadOrderStates)},
  canReadOperationalQuotes:profiles.some(profile=>profile.active),hasActiveProfiles:profiles.length>0,[projectionBrand]:true as const});
}

/** Per-run composition of the productive readers. No session/actor is forged;
 * personal rules, assignment ownership and command grants stay on the live path. */
function productivePorts():TodayProjectionPorts{
 const orderLists=new WeakMap<ProjectorAuthorization,ReturnType<typeof getOperationalOrders>>();
 const orders=(auth:ProjectorAuthorization)=>{let value=orderLists.get(auth);if(!value){value=getOperationalOrders(auth,{purpose:'today'});orderLists.set(auth,value);}return value;};
 const orderPorts:TodayOrderReadPorts={readVat:readInvoiceVat,readSettings:readShippingSettingsInTransaction,
  readCredit:(tx,tenantId,customerId)=>readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile),
  readShipments:(auth,ids,readSettings)=>readManualShippingBatch(auth,ids,{readSettings,readCustomer:readCustomerProfile,readCustomers:readCustomerProfiles,
   readAllocation:(tx,tenantId,customerId,input)=>readShippingMergeAllocation(tx,tenantId,customerId,input,readInvoiceVat)})};
 const source=(payload:unknown,complete=true,errorCode='TODAY_PROJECTOR_SOURCE_INCOMPLETE'):TodayProjectionResult=>complete?{code:'OK',payload}:{code:'SOURCE_INCOMPLETE',errorCode,payload};
 const known=(result:{code:string})=>result.code==='OK'||result.code==='FORBIDDEN';
 return {readSettings:readTodayReadSettings,listOrderIds:async auth=>(await orders(auth)).map(row=>row.id),
  readSources:async(auth,keys)=>{
   // PL08:59: absence of an actual active profile is not a zero-valued
   // financial/task result. Keep every section unavailable for the live escape.
   if(!auth.hasActiveProfiles)return new Map(keys.map(key=>[todaySourceKey(key),{code:'SOURCE_INCOMPLETE' as const,errorCode:'TODAY_PROJECTOR_ACTIVE_PROFILE_MISSING'}]));
   const values=new Map<string,TodayProjectionResult>(),day=readTodayCalendar(new Date()).today,access=todaySourceAccess(auth);
   const orderKeys=keys.filter(key=>key.kind==='order');
   if(orderKeys.length){
    const rows=await readTodayOrderSources(auth,orderKeys.map(key=>key.sourceId),orderPorts);
    await Promise.all(rows.map(async row=>{
     const key='order:'+row.orderId,result=row.result;
     if(result.code!=='OK'){values.set(key,source(result,false,'TODAY_PROJECTOR_ORDER_SOURCE_INCOMPLETE'));return;}
     const liveCardStatus=await readLiveOrderCardSource(auth,{orderId:row.orderId});
     if(liveCardStatus.code!=='OK'||liveCardStatus.data.version!==result.data.card.version){values.set(key,source({result,liveCardStatus},false,'TODAY_PROJECTOR_LIVE_CARD_SOURCE_INCOMPLETE'));return;}
     values.set(key,{code:'OK',payload:{result,liveCardStatus},sourceVersion:result.data.card.version,listed:true});
    }));
   }
   await Promise.all(keys.filter(key=>key.kind!=='order').map(async key=>{
    try{
     let result:TodayProjectionResult;
     switch(key.kind){
      case 'orders':result=source(access.orders?await orders(auth):{code:'FORBIDDEN'});break;
      case 'messages':{const read=await readIntakeMessagesForAuthorization(auth,'offen');result=source(read,known(read));break;}
      case 'complaints':{const read=await readComplaintsForAuthorization(auth);result=source(read,known(read));break;}
      case 'company':{const read=await readCompanyLetterSettings({tenantId:auth.tenantId,canRead:auth.canReadArea('preise')});result=source(read,known(read));break;}
      case 'quote_followups':result=source(await withPrivilegedTenantTransaction(auth,tx=>readQuoteFollowupTasksForToday(tx,auth,day)));break;
      case 'money':{const read=await readTodayMoneySupport(auth,day);result=source(read,!read.supportMissing.length&&[read.invoiceSource,read.prepaymentSource,read.collectionSource,read.invoiceMailSource].every(known));break;}
      case 'tasks':{const read=await readTaskForAuthorization(auth,{calendar:true});result=source(read,known(read));break;}
      case 'quotes':{
       // The live Today list uses the existing operational read capability;
       // financial masking and all actor-bound U2 commands remain live.
       const context={tenantId:auth.tenantId,capabilities:{canReadQuote:auth.canReadOperationalQuotes&&access.messages}};
       const list=await listOpenQuotesCommand(context);
       if(list.code!=='OK'){result=source({list},known(list));break;}
       const cards=await Promise.all(list.quotes.map(async quote=>{
        const read=await readQuoteCommand(context,{quoteId:quote.quoteId});
        const actors=read.code==='OK'?await readQuoteActors(context,{quoteId:read.quote.quoteId,version:read.quote.version}):null;
        return {quoteId:quote.quoteId,read,actors,versionMatches:read.code==='OK'&&read.quote.version===quote.version};
       }));
       result=source({list,cards},cards.every(card=>card.versionMatches&&card.actors?.code==='OK'));break;
      }
      default:throw Error('TODAY_PROJECTOR_KIND_INVALID');
     }
     values.set(todaySourceKey(key),result);
    }catch{values.set(todaySourceKey(key),{code:'SOURCE_INCOMPLETE',errorCode:'TODAY_PROJECTOR_SOURCE_FAILED'});}
   }));
   return values;
  }};
}

async function claim(tenantId:string,settings:TodayReadSettings):Promise<Lease|null>{
 return withPrivilegedTenantTransaction({tenantId},async tx=>{
  await tx.execute(sql`INSERT INTO private.today_tenant_v1(tenant_id) VALUES(${tenantId}) ON CONFLICT(tenant_id) DO NOTHING`);
  const rows=await tx.execute<Lease>(sql`UPDATE private.today_tenant_v1 SET refresh_lease_until=statement_timestamp()+interval '1 second'*${settings.todayRefreshLeaseSeconds}
   WHERE tenant_id=${tenantId} AND (refresh_lease_until IS NULL OR refresh_lease_until<statement_timestamp())
   RETURNING refresh_lease_until::text AS token,tenant_seq::text AS "tenantSeq",to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS day`);
  return rows.length===1?rows[0]:null;
 });
}
async function release(tenantId:string,lease:Lease){
 await withPrivilegedTenantTransaction({tenantId},tx=>tx.execute(sql`UPDATE private.today_tenant_v1 SET refresh_lease_until=NULL
  WHERE tenant_id=${tenantId} AND refresh_lease_until=${lease.token}::timestamptz`));
}
async function pending(tenantId:string,lease:Lease,limit?:number):Promise<Snapshot[]>{
 return withPrivilegedTenantTransaction({tenantId},tx=>tx.execute<Snapshot>(sql`SELECT source.kind,source.source_id AS "sourceId",source.source_seq::text AS "sourceSeq",tenant.tenant_seq::text AS "tenantSeq",${lease.day}::text AS day
  FROM private.today_source_v1 source JOIN private.today_tenant_v1 tenant ON tenant.tenant_id=source.tenant_id
  WHERE source.tenant_id=${tenantId} AND tenant.refresh_lease_until=${lease.token}::timestamptz AND tenant.refresh_lease_until>statement_timestamp()
   AND (source.source_seq<>source.built_seq OR source.built_tenant_seq<>tenant.tenant_seq OR source.built_day IS DISTINCT FROM ${lease.day}::date
    OR source.projector_version<>${TODAY_PROJECTOR_VERSION} OR source.status IN ('PENDING','SOURCE_INCOMPLETE'))
  ORDER BY source.built_at NULLS FIRST,source.kind,source.source_id ${limit===undefined?sql``:sql`LIMIT ${limit}`}`));
}
async function publishGroup(tenantId:string,lease:Lease,rows:readonly Snapshot[],results:ReadonlyMap<string,TodayProjectionResult>,buildMs:number,canMarkFailure=true):Promise<{built:number;stale:number}>{
 const values=rows.map(row=>{
  let result=results.get(todaySourceKey(row))??{code:'SOURCE_INCOMPLETE' as const,errorCode:'TODAY_PROJECTOR_SOURCE_MISSING'};
  let payload:string|null=null;
  try{
   if(result.code==='OK'){
    if(result.payload===undefined||row.kind==='order'&&(!Number.isSafeInteger(result.sourceVersion)||Number(result.sourceVersion)<0||typeof result.listed!=='boolean'))throw Error('TODAY_PROJECTOR_RESULT_INVALID');
    payload=JSON.stringify(result.payload);if(payload===undefined)throw Error('TODAY_PROJECTOR_PAYLOAD_MISSING');
   }else if(result.code==='SOURCE_INCOMPLETE'){
    if(!/^[A-Z][A-Z0-9_]{0,99}$/.test(result.errorCode))throw Error('TODAY_PROJECTOR_ERROR_CODE_INVALID');
    if(result.payload!==undefined){payload=JSON.stringify(result.payload);if(payload===undefined)throw Error('TODAY_PROJECTOR_PAYLOAD_MISSING');}
   }
  }catch{result={code:'SOURCE_INCOMPLETE',errorCode:'TODAY_PROJECTOR_ROW_FAILED'};payload=null;}
  return sql`(${row.kind}::text,${row.sourceId}::text,${row.sourceSeq}::bigint,${row.tenantSeq}::bigint,${row.day}::date,
   ${result.code}::text,${result.code==='SOURCE_INCOMPLETE'?result.errorCode:null}::text,${payload}::jsonb,
   ${result.code==='OK'&&row.kind==='order'?result.sourceVersion:null}::integer,${result.code==='OK'&&row.kind==='order'?result.listed:null}::boolean)`;
 });
 try{
  const saved=await withPrivilegedTenantTransaction({tenantId},tx=>tx.execute(sql`UPDATE private.today_source_v1 source
   SET payload=build.payload,status=build.status,error_code=build.error_code,
    listed=CASE WHEN build.status='GONE' THEN false WHEN build.kind='order' AND build.status='OK' THEN build.listed ELSE source.listed END,
    source_version=build.source_version,built_seq=build.source_seq,built_tenant_seq=build.tenant_seq,built_day=build.day,
    projector_version=${TODAY_PROJECTOR_VERSION},built_at=statement_timestamp(),build_ms=${buildMs}
   FROM (VALUES ${sql.join(values,sql`, `)}) AS build(kind,source_id,source_seq,tenant_seq,day,status,error_code,payload,source_version,listed),private.today_tenant_v1 tenant
   WHERE source.tenant_id=${tenantId} AND source.kind=build.kind AND source.source_id=build.source_id AND source.source_seq=build.source_seq
    AND tenant.tenant_id=source.tenant_id AND tenant.tenant_seq=build.tenant_seq
    AND tenant.refresh_lease_until=${lease.token}::timestamptz AND tenant.refresh_lease_until>statement_timestamp()
    AND (build.kind<>'order' OR build.status<>'OK' OR EXISTS(SELECT 1 FROM public.orders orders
      WHERE orders.tenant_id=source.tenant_id AND orders.id=source.source_id AND orders.version=build.source_version))
   RETURNING source.source_id`));
  return {built:saved.length,stale:rows.length-saved.length};
 }catch{
  // A failed group rolls back natively before it is split. Normal operation is
  // one set-based UPDATE per <=15 sources, never one transaction per row.
  if(rows.length>1){const middle=Math.ceil(rows.length/2),a=await publishGroup(tenantId,lease,rows.slice(0,middle),results,buildMs),b=await publishGroup(tenantId,lease,rows.slice(middle),results,buildMs);return {built:a.built+b.built,stale:a.stale+b.stale};}
  if(canMarkFailure)return publishGroup(tenantId,lease,rows,new Map([[todaySourceKey(rows[0]),{code:'SOURCE_INCOMPLETE',errorCode:'TODAY_PROJECTOR_ROW_FAILED'}]]),buildMs,false);
  console.error('[TODAY_PROJECTOR_ROW_FAILED]',{code:'SOURCE_INCOMPLETE'});return {built:0,stale:1};
 }
}
async function projectGroup(auth:ProjectorAuthorization,lease:Lease,rows:readonly Snapshot[],ports:TodayProjectionPorts):Promise<{built:number;stale:number}>{
 const started=performance.now();
 let results:ReadonlyMap<string,TodayProjectionResult>;
 try{results=await ports.readSources(auth,rows);}
 catch{
  if(rows.length>1){const middle=Math.ceil(rows.length/2),a=await projectGroup(auth,lease,rows.slice(0,middle),ports),b=await projectGroup(auth,lease,rows.slice(middle),ports);return {built:a.built+b.built,stale:a.stale+b.stale};}
  results=new Map([[todaySourceKey(rows[0]),{code:'SOURCE_INCOMPLETE',errorCode:'TODAY_PROJECTOR_SOURCE_FAILED'}]]);
 }
 return publishGroup(auth.tenantId,lease,rows,results,Math.round(performance.now()-started));
}

async function runProjection(tenantId:string,ports:TodayProjectionPorts,rebuild:boolean){
 const settings=await ports.readSettings({tenantId}),lease=await claim(tenantId,settings);
 if(!lease)return {code:'BUSY' as const,built:0,stale:0};
 try{
  const auth=await projectorAuthorization(tenantId);
  if(rebuild){
   const known=await withPrivilegedTenantTransaction({tenantId},tx=>tx.execute<{id:string;seq:string}>(sql`SELECT source_id AS id,source_seq::text AS seq FROM private.today_source_v1 WHERE tenant_id=${tenantId} AND kind='order' ORDER BY source_id`));
   const ids=await ports.listOrderIds(auth);
   if(ids.some(id=>typeof id!=='string'||!id.length||id.length>128)||new Set(ids).size!==ids.length)throw Error('TODAY_PROJECTOR_ORDER_LIST_INVALID');
   const keys:TodaySourceKey[]=[...TODAY_LIST_KINDS.map(kind=>({kind,sourceId:'*'})),...ids.map(sourceId=>({kind:'order' as const,sourceId}))];
   await withPrivilegedTenantTransaction({tenantId},async tx=>{
    if(keys.length)await tx.execute(sql`INSERT INTO private.today_source_v1(tenant_id,kind,source_id)
     SELECT ${tenantId},key.kind,key.id FROM (VALUES ${sql.join(keys.map(key=>sql`(${key.kind}::text,${key.sourceId}::text)`),sql`, `)}) AS key(kind,id)
     WHERE EXISTS(SELECT 1 FROM private.today_tenant_v1 tenant WHERE tenant.tenant_id=${tenantId} AND tenant.refresh_lease_until=${lease.token}::timestamptz AND tenant.refresh_lease_until>statement_timestamp())
     ORDER BY key.kind,key.id ON CONFLICT(tenant_id,kind,source_id) DO UPDATE SET listed=true,source_seq=today_source_v1.source_seq+1`);
    const removed=known.filter(row=>!ids.includes(row.id));
    if(removed.length)await tx.execute(sql`UPDATE private.today_source_v1 source SET listed=false,status='GONE',payload=NULL,source_version=NULL,built_seq=source_seq,
     built_tenant_seq=${lease.tenantSeq}::bigint,built_day=${lease.day}::date,projector_version=${TODAY_PROJECTOR_VERSION},built_at=statement_timestamp()
     FROM (VALUES ${sql.join(removed.map(row=>sql`(${row.id}::text,${row.seq}::bigint)`),sql`, `)}) AS old(id,seq)
     WHERE source.tenant_id=${tenantId} AND source.kind='order' AND source.source_id=old.id AND source.source_seq=old.seq
      AND EXISTS(SELECT 1 FROM private.today_tenant_v1 tenant WHERE tenant.tenant_id=${tenantId} AND tenant.tenant_seq=${lease.tenantSeq}::bigint
       AND tenant.refresh_lease_until=${lease.token}::timestamptz AND tenant.refresh_lease_until>statement_timestamp())`);
   });
  }
  // Freeze this finite worklist. Writes that race this build remain stale for
  // the next bounded refresh; neither failures nor writers cause a rebuild loop.
  const rows=await pending(tenantId,lease,rebuild?undefined:settings.todayRefreshBatchLimit);
  let built=0,stale=0;
  for(let offset=0;offset<rows.length;offset+=15){const result=await projectGroup(auth,lease,rows.slice(offset,offset+15),ports);built+=result.built;stale+=result.stale;}
  if(rebuild)await withPrivilegedTenantTransaction({tenantId},tx=>tx.execute(sql`UPDATE private.today_tenant_v1 SET rebuilt_at=statement_timestamp() WHERE tenant_id=${tenantId} AND refresh_lease_until=${lease.token}::timestamptz`));
  return {code:'OK' as const,built,stale};
 }finally{await release(tenantId,lease);}
}
const projectionCounts=(result:{built:number;stale:number})=>({rows:result.built+result.stale,built:result.built,stale:result.stale});
export const refreshTodayModel=(tenantId:string,ports:TodayProjectionPorts=productivePorts())=>withPageReadPhase('today.refresh',()=>runProjection(tenantId,ports,false),projectionCounts);
export const rebuildTodayModel=(tenantId:string,ports:TodayProjectionPorts=productivePorts())=>withPageReadPhase('today.refresh',()=>runProjection(tenantId,ports,true),projectionCounts);
