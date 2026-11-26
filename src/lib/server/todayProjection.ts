import 'server-only';
import {sql} from 'drizzle-orm';
import {assertPageReadBudgetActive,configurePageReadBudget,expirePageReadBudget,outsidePageReadBudget,withPageReadBudget,withPageReadPhase} from '@/db/readBudget';
import {canReadTaskArea,getFixedAccessAreasForRole,getPermissionsForAreas,isAccessArea,isAppRole,normalizeAccessAreasForRole,type AccessArea,type PermissionKey} from '@/lib/auth/authorizationContract';
import {boundedTodayRefreshBudgetMs,type TodayReadSettings} from '@/modules/fundament/public';
import {readTodayReadSettings,readCompanyLetterSettings,readShippingSettingsInTransaction,readBetriebsruheInTransaction} from '@/modules/fundament/server-public';
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
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {TAG_QUELLEN,TODAY_PROJECTOR_VERSION,todaySourceNeedsRebuild} from './todayProjectionSchedule';
const auftragsQuelle=TAG_QUELLEN.find(quelle=>quelle.bestand?.umfang==='auftrag'&&quelle.bestand.leser==='order');
if(!auftragsQuelle)throw Error('TODAY_PROJECTOR_ORDER_SOURCE_MISSING');
const AUFTRAGSQUELLE='quelle:'+auftragsQuelle.id;
const listenQuellen=new Map<string,string>(TAG_QUELLEN.flatMap(quelle=>quelle.bestand?.umfang==='mandant'
 ? [[`quelle:${quelle.id}`,quelle.bestand.leser] as const]:[]));
const projectionBrand:unique symbol=Symbol('TodayReadOnlyProjector');
/** A read capability, never an AuthorizationSnapshot or a command identity. */
export type ProjectorAuthorization=Readonly<{tenantId:string;areas:readonly AccessArea[];permissions:readonly PermissionKey[];canReadArea:(area:AccessArea)=>boolean;canReadTaskArea:(area:AccessArea|null)=>boolean;payment:PaymentReadAuthorization;canReadOperationalQuotes:boolean;hasActiveProfiles:boolean;[projectionBrand]:true}>;
type TodaySourceKey=Readonly<{kind:string;sourceId:string}>;
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
const leaseWrites=new WeakMap<Lease,Promise<void>>();
/** Renewal and the short publishing phases share one per-worker write queue.
 * A changing lease token is never raced by this worker's own publication. */
function withLeaseWrite<T>(lease:Lease,work:()=>Promise<T>):Promise<T>{
 const next=(leaseWrites.get(lease)??Promise.resolve()).then(work);
 leaseWrites.set(lease,next.then(()=>undefined,()=>undefined));
 return next;
}
function keepLeaseAlive(tenantId:string,lease:Lease,seconds:number){
 let stopped=false,owned=true,timer:ReturnType<typeof setTimeout>|undefined;
 let running:Promise<void>=Promise.resolve();
 const schedule=()=>{timer=setTimeout(()=>{
  running=withLeaseWrite(lease,()=>withPrivilegedTenantTransaction({tenantId},async tx=>{
   await tx.execute(sql`SELECT 1 FROM private.today_tenant_v1 WHERE tenant_id=${tenantId} FOR UPDATE`);
   const rows=await tx.execute<{token:string}>(sql`UPDATE private.today_tenant_v1 SET refresh_lease_until=clock_timestamp()+interval '1 second'*${seconds}
    WHERE tenant_id=${tenantId} AND refresh_lease_until=${lease.token}::timestamptz AND refresh_lease_until>clock_timestamp()
    RETURNING refresh_lease_until::text AS token`);
   if(rows.length!==1)throw Error('TODAY_PROJECTOR_LEASE_LOST');
   lease.token=rows[0].token;
  })).catch(()=>{owned=false;expirePageReadBudget();console.error('[TODAY_PROJECTOR_LEASE_LOST]',{code:'SOURCE_INCOMPLETE'});}).finally(()=>{if(!stopped&&owned)schedule();});
 },Math.max(1,Math.floor(seconds*1000/3)));};
 schedule();
 return {assertOwned:()=>{if(!owned)throw Error('TODAY_PROJECTOR_LEASE_LOST');},stop:async()=>{stopped=true;if(timer)clearTimeout(timer);await running;}};
}

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
 const orders=(auth:ProjectorAuthorization)=>{
  let value=orderLists.get(auth);
  if(!value){
   value=getOperationalOrders(auth,{purpose:'today'},readBetriebsruheInTransaction);
   orderLists.set(auth,value);
  }
  return value;
 };
 const orderPorts:TodayOrderReadPorts={readVat:readInvoiceVat,readSettings:readShippingSettingsInTransaction,
  readCredit:(tx,tenantId,customerId)=>readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile),
  readShipments:(auth,ids,readSettings)=>readManualShippingBatch(auth,ids,{readSettings,readCustomer:readCustomerProfile,readCustomers:readCustomerProfiles,
   readAllocation:(tx,tenantId,customerId,input)=>readShippingMergeAllocation(tx,tenantId,customerId,input,readInvoiceVat)})};
 const source=(payload:unknown,complete=true,errorCode='TODAY_PROJECTOR_SOURCE_INCOMPLETE'):TodayProjectionResult=>complete?{code:'OK',payload}:{code:'SOURCE_INCOMPLETE',errorCode,payload};
 const known=(result:{code:string})=>result.code==='OK'||result.code==='FORBIDDEN';
 return {readSettings:context=>readTodayReadSettings({...context,fresh:true}),listOrderIds:async auth=>(await orders(auth)).map(row=>row.id),
  readSources:async(auth,keys)=>{
   // PL08:59: absence of an actual active profile is not a zero-valued
   // financial/task result. Keep every section unavailable for the live escape.
   if(!auth.hasActiveProfiles)return new Map(keys.map(key=>[todaySourceKey(key),{code:'SOURCE_INCOMPLETE' as const,errorCode:'TODAY_PROJECTOR_ACTIVE_PROFILE_MISSING'}]));
   const values=new Map<string,TodayProjectionResult>(),day=readTodayCalendar(new Date()).today,access=todaySourceAccess(auth);
   const requestedOrderKeys=keys.filter(key=>key.kind===AUFTRAGSQUELLE);
   const orderKeys:TodaySourceKey[]=[];
   if(requestedOrderKeys.length){
    let listedIds:ReadonlySet<string>|null=null;
    if(access.orders){
     try{listedIds=new Set((await orders(auth)).map(row=>row.id));}
     catch{console.error('[TODAY_PROJECTOR_ORDER_LIST_FAILED]',{code:'SOURCE_INCOMPLETE'});}
    }
    for(const key of requestedOrderKeys){
     if(listedIds===null)values.set(todaySourceKey(key),{code:'SOURCE_INCOMPLETE',errorCode:'TODAY_PROJECTOR_ORDER_LIST_UNAVAILABLE'});
     else if(!listedIds.has(key.sourceId))values.set(todaySourceKey(key),{code:'GONE'});
     else orderKeys.push(key);
    }
   }
   if(orderKeys.length){
    const rows=await readTodayOrderSources(auth,orderKeys.map(key=>key.sourceId),orderPorts);
    await Promise.all(rows.map(async row=>{
     const key=todaySourceKey({kind:AUFTRAGSQUELLE,sourceId:row.orderId}),result=row.result;
     if(result.code!=='OK'){values.set(key,source(result,false,'TODAY_PROJECTOR_ORDER_SOURCE_INCOMPLETE'));return;}
     const liveCardStatus=await readLiveOrderCardSource(auth,{orderId:row.orderId});
     if(liveCardStatus.code!=='OK'||liveCardStatus.data.version!==result.data.card.version){values.set(key,source({result,liveCardStatus},false,'TODAY_PROJECTOR_LIVE_CARD_SOURCE_INCOMPLETE'));return;}
     values.set(key,{code:'OK',payload:{result,liveCardStatus},sourceVersion:result.data.card.version,listed:true});
    }));
   }
   const bestandsLeser:Readonly<Record<string,()=>Promise<TodayProjectionResult>>>={
    orders:async()=>source(access.orders?await orders(auth):{code:'FORBIDDEN'}),
    messages:async()=>{const read=await readIntakeMessagesForAuthorization(auth,'offen');return source(read,known(read));},
    complaints:async()=>{const read=await readComplaintsForAuthorization(auth);return source(read,known(read));},
    company:async()=>{const read=await readCompanyLetterSettings({tenantId:auth.tenantId,canRead:auth.canReadArea('preise'),fresh:true});return source(read,known(read));},
    quote_followups:async()=>source(await withPrivilegedTenantTransaction(auth,tx=>readQuoteFollowupTasksForToday(tx,auth,day))),
    money:async()=>{const read=await readTodayMoneySupport(auth,day);return source(read,!read.supportMissing.length&&[read.invoiceSource,read.prepaymentSource,read.collectionSource,read.invoiceMailSource].every(known));},
    tasks:async()=>{const read=await readTaskForAuthorization(auth,{calendar:true});return source(read,known(read));},
    quotes:async()=>{
     // Keep the existing operational read capability and actor-bound masking.
     const context={tenantId:auth.tenantId,capabilities:{canReadQuote:auth.canReadOperationalQuotes&&access.messages}};
     const list=await listOpenQuotesCommand(context);
     if(list.code!=='OK')return source({list},known(list));
     const cards=await Promise.all(list.quotes.map(async quote=>{
      const read=await readQuoteCommand(context,{quoteId:quote.quoteId});
      const actors=read.code==='OK'?await readQuoteActors(context,{quoteId:read.quote.quoteId,version:read.quote.version}):null;
      return {quoteId:quote.quoteId,read,actors,versionMatches:read.code==='OK'&&read.quote.version===quote.version};
     }));
     return source({list,cards},cards.every(card=>card.versionMatches&&card.actors?.code==='OK'));
    }
   };
   await Promise.all(keys.filter(key=>key.kind!==AUFTRAGSQUELLE).map(async key=>{
    try{
     const leser=listenQuellen.get(key.kind);
     if(!leser||!Object.hasOwn(bestandsLeser,leser))throw Error('TODAY_PROJECTOR_KIND_INVALID');
     values.set(todaySourceKey(key),await bestandsLeser[leser]());
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
async function pending(tenantId:string,lease:Lease,fullRebuild:boolean,limit?:number):Promise<Snapshot[]>{
 return withPrivilegedTenantTransaction({tenantId},tx=>tx.execute<Snapshot>(sql`SELECT source.kind,source.source_id AS "sourceId",source.source_seq::text AS "sourceSeq",tenant.tenant_seq::text AS "tenantSeq",${lease.day}::text AS day
  FROM private.today_source_v1 source JOIN private.today_tenant_v1 tenant ON tenant.tenant_id=source.tenant_id
  WHERE source.tenant_id=${tenantId} AND tenant.refresh_lease_until=${lease.token}::timestamptz AND tenant.refresh_lease_until>statement_timestamp()
   AND tenant.tenant_seq=${lease.tenantSeq}::bigint AND ${todaySourceNeedsRebuild(lease.day,fullRebuild)}
  ORDER BY source.built_at NULLS FIRST,source.kind,source.source_id ${limit===undefined?sql``:sql`LIMIT ${limit}`}`));
}
/** Same short write-phase lock order as the source invalidators. Source reads
 * have already completed; the existing lease/sequence/version CAS still wins. */
async function lockProjectionSources(tx:PrivilegedTenantTransaction,tenantId:string,keys:readonly TodaySourceKey[]){
 await tx.execute(sql`SELECT 1 FROM private.today_tenant_v1 WHERE tenant_id=${tenantId} FOR UPDATE`);
 if(keys.length)await tx.execute(sql`SELECT source.kind,source.source_id FROM private.today_source_v1 source
  WHERE source.tenant_id=${tenantId} AND (source.kind,source.source_id) IN
   (VALUES ${sql.join(keys.map(key=>sql`(${key.kind}::text,${key.sourceId}::text)`),sql`, `)})
  ORDER BY source.kind,source.source_id FOR UPDATE`);
}
async function publishGroup(tenantId:string,lease:Lease,rows:readonly Snapshot[],results:ReadonlyMap<string,TodayProjectionResult>,buildMs:number,assertOwned:()=>void,canMarkFailure=true):Promise<{built:number;stale:number}>{
 assertOwned();
 const values=rows.map(row=>{
  let result=results.get(todaySourceKey(row))??{code:'SOURCE_INCOMPLETE' as const,errorCode:'TODAY_PROJECTOR_SOURCE_MISSING'};
  let payload:string|null=null;
  try{
   if(result.code==='OK'){
    if(result.payload===undefined||row.kind===AUFTRAGSQUELLE&&(!Number.isSafeInteger(result.sourceVersion)||Number(result.sourceVersion)<0||typeof result.listed!=='boolean'))throw Error('TODAY_PROJECTOR_RESULT_INVALID');
    payload=JSON.stringify(result.payload);if(payload===undefined)throw Error('TODAY_PROJECTOR_PAYLOAD_MISSING');
   }else if(result.code==='SOURCE_INCOMPLETE'){
    if(!/^[A-Z][A-Z0-9_]{0,99}$/.test(result.errorCode))throw Error('TODAY_PROJECTOR_ERROR_CODE_INVALID');
    if(result.payload!==undefined){payload=JSON.stringify(result.payload);if(payload===undefined)throw Error('TODAY_PROJECTOR_PAYLOAD_MISSING');}
   }
  }catch{result={code:'SOURCE_INCOMPLETE',errorCode:'TODAY_PROJECTOR_ROW_FAILED'};payload=null;}
  return sql`(${row.kind}::text,${row.sourceId}::text,${row.sourceSeq}::bigint,${row.tenantSeq}::bigint,${row.day}::date,
   ${result.code}::text,${result.code==='SOURCE_INCOMPLETE'?result.errorCode:null}::text,${payload}::jsonb,
   ${result.code==='OK'&&row.kind===AUFTRAGSQUELLE?result.sourceVersion:null}::integer,${result.code==='OK'&&row.kind===AUFTRAGSQUELLE?result.listed:null}::boolean)`;
 });
 try{
  const saved=await withLeaseWrite(lease,()=>withPrivilegedTenantTransaction({tenantId},async tx=>{
   await lockProjectionSources(tx,tenantId,rows);
   return tx.execute(sql`UPDATE private.today_source_v1 source
   SET payload=build.payload,status=build.status,error_code=build.error_code,
    listed=CASE WHEN build.status='GONE' THEN false WHEN build.kind=${AUFTRAGSQUELLE} AND build.status='OK' THEN build.listed ELSE source.listed END,
    source_version=build.source_version,built_seq=build.source_seq,built_tenant_seq=build.tenant_seq,built_day=build.day,
    projector_version=${TODAY_PROJECTOR_VERSION},built_at=statement_timestamp(),build_ms=${buildMs}
   FROM (VALUES ${sql.join(values,sql`, `)}) AS build(kind,source_id,source_seq,tenant_seq,day,status,error_code,payload,source_version,listed),private.today_tenant_v1 tenant
   WHERE source.tenant_id=${tenantId} AND source.kind=build.kind AND source.source_id=build.source_id AND source.source_seq=build.source_seq
    AND tenant.tenant_id=source.tenant_id AND tenant.tenant_seq=build.tenant_seq
    AND tenant.tenant_seq=${lease.tenantSeq}::bigint
    AND tenant.refresh_lease_until=${lease.token}::timestamptz AND tenant.refresh_lease_until>statement_timestamp()
    AND (build.kind<>${AUFTRAGSQUELLE} OR build.status<>'OK' OR EXISTS(SELECT 1 FROM public.orders orders
      WHERE orders.tenant_id=source.tenant_id AND orders.id=source.source_id AND orders.version=build.source_version))
   RETURNING source.source_id`);
  }));
  return {built:saved.length,stale:rows.length-saved.length};
 }catch{
  assertOwned();
  // A failed group rolls back natively before it is split. Normal operation is
  // one set-based UPDATE per <=15 sources, never one transaction per row.
  if(rows.length>1){const middle=Math.ceil(rows.length/2),a=await publishGroup(tenantId,lease,rows.slice(0,middle),results,buildMs,assertOwned),b=await publishGroup(tenantId,lease,rows.slice(middle),results,buildMs,assertOwned);return {built:a.built+b.built,stale:a.stale+b.stale};}
  if(canMarkFailure)return publishGroup(tenantId,lease,rows,new Map([[todaySourceKey(rows[0]),{code:'SOURCE_INCOMPLETE',errorCode:'TODAY_PROJECTOR_ROW_FAILED'}]]),buildMs,assertOwned,false);
  console.error('[TODAY_PROJECTOR_ROW_FAILED]',{code:'SOURCE_INCOMPLETE'});return {built:0,stale:1};
 }
}
async function projectGroup(auth:ProjectorAuthorization,lease:Lease,rows:readonly Snapshot[],ports:TodayProjectionPorts,assertOwned:()=>void):Promise<{built:number;stale:number}>{
 assertOwned();
 const started=performance.now();
 let results:ReadonlyMap<string,TodayProjectionResult>;
 try{results=await ports.readSources(auth,rows);}
 catch{
  assertOwned();
  if(rows.length>1){const middle=Math.ceil(rows.length/2),a=await projectGroup(auth,lease,rows.slice(0,middle),ports,assertOwned),b=await projectGroup(auth,lease,rows.slice(middle),ports,assertOwned);return {built:a.built+b.built,stale:a.stale+b.stale};}
  results=new Map([[todaySourceKey(rows[0]),{code:'SOURCE_INCOMPLETE',errorCode:'TODAY_PROJECTOR_SOURCE_FAILED'}]]);
 }
 return publishGroup(auth.tenantId,lease,rows,results,Math.round(performance.now()-started),assertOwned);
}

async function runProjection(tenantId:string,ports:TodayProjectionPorts,rebuild:boolean,signal?:AbortSignal){
 signal?.throwIfAborted();
 const settings=await ports.readSettings({tenantId}),lease=await claim(tenantId,settings);
 if(!lease)return {code:'BUSY' as const,built:0,stale:0};
 const heartbeat=keepLeaseAlive(tenantId,lease,settings.todayRefreshLeaseSeconds);
 const assertOwned=()=>{signal?.throwIfAborted();assertPageReadBudgetActive();heartbeat.assertOwned();};
 try{
  assertOwned();
  const auth=await projectorAuthorization(tenantId);
  if(rebuild){
   const known=await withPrivilegedTenantTransaction({tenantId},tx=>tx.execute<{id:string;seq:string}>(sql`SELECT source_id AS id,source_seq::text AS seq FROM private.today_source_v1 WHERE tenant_id=${tenantId} AND kind=${AUFTRAGSQUELLE} ORDER BY source_id`));
   const ids=await ports.listOrderIds(auth);
   if(ids.some(id=>typeof id!=='string'||!id.length||id.length>128)||new Set(ids).size!==ids.length)throw Error('TODAY_PROJECTOR_ORDER_LIST_INVALID');
   const keys:TodaySourceKey[]=[...Array.from(listenQuellen.keys(),kind=>({kind,sourceId:'*'})),...ids.map(sourceId=>({kind:AUFTRAGSQUELLE,sourceId}))];
   await withLeaseWrite(lease,()=>withPrivilegedTenantTransaction({tenantId},async tx=>{
    await lockProjectionSources(tx,tenantId,[...keys,...known.map(row=>({kind:AUFTRAGSQUELLE,sourceId:row.id}))]);
    const generation=await tx.execute<{initializing:boolean}>(sql`SELECT rebuilt_at IS DISTINCT FROM '-infinity'::timestamptz AS initializing
     FROM private.today_tenant_v1 WHERE tenant_id=${tenantId} AND tenant_seq=${lease.tenantSeq}::bigint
      AND refresh_lease_until=${lease.token}::timestamptz FOR UPDATE`);
    if(generation.length!==1)throw Error('TODAY_PROJECTOR_LEASE_LOST');
    if(generation[0].initializing)await tx.execute(sql`UPDATE private.today_tenant_v1 SET rebuilt_at='-infinity'::timestamptz
     WHERE tenant_id=${tenantId} AND tenant_seq=${lease.tenantSeq}::bigint AND refresh_lease_until=${lease.token}::timestamptz`);
    if(keys.length)await tx.execute(sql`INSERT INTO private.today_source_v1(tenant_id,kind,source_id)
     SELECT ${tenantId},key.kind,key.id FROM (VALUES ${sql.join(keys.map(key=>sql`(${key.kind}::text,${key.sourceId}::text)`),sql`, `)}) AS key(kind,id)
     WHERE EXISTS(SELECT 1 FROM private.today_tenant_v1 tenant WHERE tenant.tenant_id=${tenantId} AND tenant.tenant_seq=${lease.tenantSeq}::bigint AND tenant.refresh_lease_until=${lease.token}::timestamptz AND tenant.refresh_lease_until>statement_timestamp())
     ORDER BY key.kind,key.id ON CONFLICT(tenant_id,kind,source_id) DO UPDATE SET listed=true,
      source_seq=today_source_v1.source_seq+CASE WHEN ${generation[0].initializing} THEN 1 ELSE 0 END`);
    const removed=known.filter(row=>!ids.includes(row.id));
    if(removed.length)await tx.execute(sql`UPDATE private.today_source_v1 source SET listed=false,status='GONE',payload=NULL,source_version=NULL,built_seq=source_seq,
     built_tenant_seq=${lease.tenantSeq}::bigint,built_day=${lease.day}::date,projector_version=${TODAY_PROJECTOR_VERSION},built_at=statement_timestamp()
     FROM (VALUES ${sql.join(removed.map(row=>sql`(${row.id}::text,${row.seq}::bigint)`),sql`, `)}) AS old(id,seq)
     WHERE source.tenant_id=${tenantId} AND source.kind=${AUFTRAGSQUELLE} AND source.source_id=old.id AND source.source_seq=old.seq
      AND EXISTS(SELECT 1 FROM private.today_tenant_v1 tenant WHERE tenant.tenant_id=${tenantId} AND tenant.tenant_seq=${lease.tenantSeq}::bigint
       AND tenant.refresh_lease_until=${lease.token}::timestamptz AND tenant.refresh_lease_until>statement_timestamp())`);
   }));
  }
  // Freeze this finite worklist. Writes that race this build remain stale for
  // the next bounded refresh; neither failures nor writers cause a rebuild loop.
  const rows=await withLeaseWrite(lease,()=>pending(tenantId,lease,rebuild,rebuild?undefined:settings.todayRefreshBatchLimit));
  let built=0,stale=0;
  for(let offset=0;offset<rows.length;offset+=15){
   assertOwned();
   const result=await projectGroup(auth,lease,rows.slice(offset,offset+15),ports,assertOwned);assertOwned();built+=result.built;stale+=result.stale;
  }
  assertOwned();
  if(rebuild){
   const remaining=await withLeaseWrite(lease,()=>pending(tenantId,lease,true,1));
   if(remaining.length)stale+=remaining.length;
   if(!remaining.length&&!stale){
    const completed=await withLeaseWrite(lease,()=>withPrivilegedTenantTransaction({tenantId},tx=>tx.execute(sql`UPDATE private.today_tenant_v1 SET rebuilt_at=statement_timestamp() WHERE tenant_id=${tenantId} AND tenant_seq=${lease.tenantSeq}::bigint AND refresh_lease_until=${lease.token}::timestamptz AND refresh_lease_until>statement_timestamp() RETURNING tenant_id`)));
    if(completed.length!==1)return {code:'INCOMPLETE' as const,built,stale};
   }
  }
  assertPageReadBudgetActive();
  return {code:'OK' as const,built,stale};
 }catch(error){if(error instanceof Error&&error.message==='TODAY_PROJECTOR_LEASE_LOST')return {code:'INCOMPLETE' as const,built:0,stale:0};throw error;}
 finally{await heartbeat.stop();await outsidePageReadBudget(()=>withPageReadBudget(()=>release(tenantId,lease),2000));}
}
const projectionCounts=(result:{built:number;stale:number})=>({rows:result.built+result.stale,built:result.built,stale:result.stale});
export const refreshTodayModel=(tenantId:string,ports:TodayProjectionPorts=productivePorts(),options?:{bounded:true;signal?:AbortSignal})=>{
 const run=(selected=ports)=>withPageReadPhase('today.refresh',()=>runProjection(tenantId,selected,false,options?.signal),projectionCounts);
 if(!options?.bounded)return run();
 return withPageReadBudget(async()=>{
  const settings=await readTodayReadSettings({tenantId,fresh:true});
  configurePageReadBudget(boundedTodayRefreshBudgetMs(settings.todayRefreshLeaseSeconds));
  return run({...ports,readSettings:async()=>settings});
 },5000);
};
export const rebuildTodayModel=(tenantId:string,ports:TodayProjectionPorts=productivePorts(),options?:{bounded:true;signal?:AbortSignal})=>{
 const run=()=>withPageReadPhase('today.refresh',()=>runProjection(tenantId,ports,true,options?.signal),projectionCounts);
 if(!options?.bounded)return run();
 return withPageReadBudget(async()=>{
  const settings=await readTodayReadSettings({tenantId,fresh:true});
  configurePageReadBudget(boundedTodayRefreshBudgetMs(settings.todayRefreshLeaseSeconds));
  return run();
 },5000);
};
